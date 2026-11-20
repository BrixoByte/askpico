package com.askpico.pico.agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.askpico.pico.MainActivity
import com.askpico.pico.R

/**
 * Polls UsageStatsManager for the foreground app and covers blocked apps with a
 * TYPE_APPLICATION_OVERLAY. Requires usage access and "display over other apps".
 */
class ShieldService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var windowManager: WindowManager? = null
    private var audioManager: AudioManager? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var overlay: View? = null
    private var currentForeground: String? = null
    private var overlayFor: String? = null

    private val poll = object : Runnable {
        override fun run() {
            checkForeground()
            handler.postDelayed(this, POLL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        createChannel()
        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!(ShieldRules.isEnabled(this) || FocusStore.isEnabled(this)) || !Capabilities.hasUsageAccess(this)) {
            stopSelf()
            return START_NOT_STICKY
        }
        handler.removeCallbacks(poll)
        handler.post(poll)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(poll)
        hideOverlay()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // Closed by the user: the card stays away until the app is left and opened again.
    private var dismissedFor: String? = null

    private fun checkForeground() {
        if (!ShieldRules.isEnabled(this) && !FocusStore.isEnabled(this)) {
            stopSelf()
            return
        }
        currentForeground = latestForegroundPackage() ?: currentForeground
        val fg = currentForeground
        if (fg != dismissedFor) dismissedFor = null
        val now = System.currentTimeMillis()
        val blocked = (if (ShieldRules.isEnabled(this)) ShieldRules.blockedPackages(this) else emptySet()) +
            FocusStore.blockedPackages(this, now)
        // Under system memory pressure the overlay is dropped — the shield
        // keeps polling but never draws until the process restarts.
        if (fg != null && fg != packageName && fg !in neverOverlay && fg in blocked && fg != dismissedFor && !memoryPressure) {
            if (overlayFor != fg) showOverlay(fg)
            muteShieldAudio()
        } else {
            hideOverlay()
        }
    }

    private fun latestForegroundPackage(): String? {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(now - WINDOW_MS, now) ?: return null
        val event = UsageEvents.Event()
        var latest: String? = null
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == foregroundEventType) {
                latest = event.packageName
            }
        }
        return latest
    }

    private fun showOverlay(blockedPackage: String) {
        hideOverlay()
        requestShieldAudioFocus()
        val wm = windowManager ?: return
        val view = buildOverlayView(blockedPackage)
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.OPAQUE
        )
        try {
            wm.addView(view, params)
            overlay = view
            overlayFor = blockedPackage
            handler.removeCallbacks(muteGuard)
            handler.post(muteGuard)
        } catch (_: Exception) {
            overlay = null
            overlayFor = null
        }
    }

    private fun hideOverlay() {
        handler.removeCallbacks(muteGuard)
        unmuteShieldAudio()
        abandonShieldAudioFocus()
        val view = overlay ?: return
        try {
            windowManager?.removeView(view)
        } catch (_: Exception) {
        }
        overlay = null
        overlayFor = null
    }

    // Mutes the media stream while a blocked app is covered. Only undoes a mute this service set.
    private var mutedByShield = false

    // Re-asserts the mute while the overlay is up, so a volume-button press is undone within MUTE_GUARD_MS.
    private val muteGuard = object : Runnable {
        override fun run() {
            if (overlay == null) return
            muteShieldAudio()
            handler.postDelayed(this, MUTE_GUARD_MS)
        }
    }

    private fun muteShieldAudio() {
        val am = audioManager ?: return
        if (am.isStreamMute(AudioManager.STREAM_MUSIC)) return
        am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_MUTE, 0)
        mutedByShield = true
    }

    private fun unmuteShieldAudio() {
        if (!mutedByShield) return
        audioManager?.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_UNMUTE, 0)
        mutedByShield = false
    }

    private var legacyAudioFocusGranted = false
    private val legacyFocusListener = AudioManager.OnAudioFocusChangeListener { }

    private fun requestShieldAudioFocus() {
        if (audioFocusRequest != null || legacyAudioFocusGranted) return
        val am = audioManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                .setOnAudioFocusChangeListener { }
                .build()
            if (am.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                audioFocusRequest = request
            }
        } else {
            @Suppress("DEPRECATION")
            legacyAudioFocusGranted = am.requestAudioFocus(
                legacyFocusListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
            ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        }
    }

    private fun abandonShieldAudioFocus() {
        audioFocusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
        audioFocusRequest = null
        if (legacyAudioFocusGranted) {
            @Suppress("DEPRECATION")
            audioManager?.abandonAudioFocus(legacyFocusListener)
            legacyAudioFocusGranted = false
        }
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    private fun buildOverlayView(blockedPackage: String): View {
        val appName = try {
            @Suppress("DEPRECATION")
            val info = packageManager.getApplicationInfo(blockedPackage, 0)
            packageManager.getApplicationLabel(info).toString()
        } catch (_: Exception) {
            "This app"
        }

        val icon = ImageView(this).apply {
            setImageResource(R.drawable.ic_shield)
        }
        val tile = FrameLayout(this).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(
                    ContextCompat.getColor(this@ShieldService, R.color.brand_500),
                    ContextCompat.getColor(this@ShieldService, R.color.brand_600)
                )
            ).apply { cornerRadius = dp(24).toFloat() }
            addView(icon, FrameLayout.LayoutParams(dp(36), dp(36), Gravity.CENTER))
        }
        val title = TextView(this).apply {
            text = "$appName is blocked"
            textSize = 22f
            setTextColor(ContextCompat.getColor(this@ShieldService, R.color.shield_text))
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        val detail = TextView(this).apply {
            text = "Take a breath. Pico is ready when you are."
            textSize = 14f
            setTextColor(ContextCompat.getColor(this@ShieldService, R.color.shield_text_muted))
            gravity = Gravity.CENTER
        }
        val back = Button(this).apply {
            text = "Back to Pico"
            isAllCaps = false
            minWidth = 0
            minHeight = 0
            stateListAnimator = null
            setTextColor(Color.WHITE)
            setBackgroundResource(R.drawable.bg_button_primary)
            setPadding(dp(28), dp(12), dp(28), dp(12))
            setOnClickListener {
                hideOverlay()
                startActivity(
                    Intent(this@ShieldService, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                )
            }
        }
        val close = Button(this).apply {
            text = "Close"
            isAllCaps = false
            minWidth = 0
            minHeight = 0
            stateListAnimator = null
            setTextColor(ContextCompat.getColor(this@ShieldService, R.color.shield_text_muted))
            setBackgroundColor(Color.TRANSPARENT)
            setOnClickListener {
                dismissedFor = blockedPackage
                hideOverlay()
            }
        }
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(32), dp(32), dp(32), dp(32))
            val wrap = ViewGroup.LayoutParams.WRAP_CONTENT
            addView(tile, LinearLayout.LayoutParams(dp(72), dp(72)))
            addView(title, LinearLayout.LayoutParams(wrap, wrap).apply { topMargin = dp(28) })
            addView(detail, LinearLayout.LayoutParams(wrap, wrap).apply { topMargin = dp(12) })
            addView(back, LinearLayout.LayoutParams(wrap, wrap).apply { topMargin = dp(40) })
            addView(close, LinearLayout.LayoutParams(wrap, wrap).apply { topMargin = dp(12) })
        }
        val footer = TextView(this).apply {
            text = "Protected by Pico"
            textSize = 12f
            setTextColor(ContextCompat.getColor(this@ShieldService, R.color.shield_footer))
            gravity = Gravity.CENTER
        }
        return FrameLayout(this).apply {
            // Fully opaque gradient — the blocked app must not show through.
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(
                    ContextCompat.getColor(this@ShieldService, R.color.shield_bg_top),
                    ContextCompat.getColor(this@ShieldService, R.color.shield_bg_bottom)
                )
            )
            addView(content, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            ))
            addView(footer, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
            ).apply { bottomMargin = dp(32) })
        }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Distraction shield",
            NotificationManager.IMPORTANCE_LOW
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_shield)
            .setContentTitle("Pico shield is on")
            .setContentText("Blocked apps are covered while this is active.")
            .setOngoing(true)
            .build()

    companion object {
        private const val CHANNEL_ID = "pico_shield"
        private const val NOTIFICATION_ID = 4101
        private const val POLL_MS = 1000L
        private const val WINDOW_MS = 10_000L
        private const val MUTE_GUARD_MS = 250L

        private val foregroundEventType: Int
            get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                UsageEvents.Event.ACTIVITY_RESUMED
            } else {
                @Suppress("DEPRECATION")
                UsageEvents.Event.MOVE_TO_FOREGROUND
            }

        // Set by MainActivity.onTrimMemory. Latched: once the system reports
        // low memory the overlay stays off for the rest of the process.
        @Volatile var memoryPressure: Boolean = false
            private set

        fun setMemoryPressure(value: Boolean) {
            if (value) memoryPressure = true
        }

        // Never overlaid, even if a session includes them: Pico, the dialer, Settings, emergency and system UI.
        private val neverOverlay = setOf(
            "com.android.dialer",
            "com.google.android.dialer",
            "com.android.settings",
            "com.android.systemui",
            "com.android.emergency",
            "com.google.android.apps.emergencyassist",
        )

        fun sync(context: Context) {
            val intent = Intent(context, ShieldService::class.java)
            if (ShieldRules.isEnabled(context) || FocusStore.isEnabled(context)) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } else {
                context.stopService(intent)
            }
        }
    }
}
