package com.askpico.pico.agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import com.askpico.pico.MainActivity

/**
 * Polls UsageStatsManager for the foreground app and covers blocked apps with a
 * TYPE_APPLICATION_OVERLAY. Requires usage access and "display over other apps".
 */
class ShieldService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var windowManager: WindowManager? = null
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
        createChannel()
        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!ShieldRules.isEnabled(this) || !Capabilities.hasUsageAccess(this)) {
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

    private fun checkForeground() {
        if (!ShieldRules.isEnabled(this)) {
            stopSelf()
            return
        }
        currentForeground = latestForegroundPackage() ?: currentForeground
        val fg = currentForeground
        val blocked = ShieldRules.blockedPackages(this)
        if (fg != null && fg != packageName && fg in blocked) {
            if (overlayFor != fg) showOverlay(fg)
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
            PixelFormat.TRANSLUCENT
        )
        try {
            wm.addView(view, params)
            overlay = view
            overlayFor = blockedPackage
        } catch (_: Exception) {
            overlay = null
            overlayFor = null
        }
    }

    private fun hideOverlay() {
        val view = overlay ?: return
        try {
            windowManager?.removeView(view)
        } catch (_: Exception) {
        }
        overlay = null
        overlayFor = null
    }

    private fun buildOverlayView(blockedPackage: String): View {
        val title = TextView(this).apply {
            text = "This app is blocked by your shield"
            textSize = 20f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        val detail = TextView(this).apply {
            text = "Take a breath. Pico is ready when you are."
            textSize = 14f
            setTextColor(Color.LTGRAY)
            gravity = Gravity.CENTER
        }
        val back = Button(this).apply {
            text = "Back to Pico"
            setOnClickListener {
                hideOverlay()
                startActivity(
                    Intent(this@ShieldService, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                )
            }
        }
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.argb(235, 9, 9, 11))
            setPadding(48, 48, 48, 48)
            addView(title, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            addView(detail, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = 24 })
            addView(back, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = 48 })
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
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle("Pico shield is on")
            .setContentText("Blocked apps are covered while this is active.")
            .setOngoing(true)
            .build()

    companion object {
        private const val CHANNEL_ID = "pico_shield"
        private const val NOTIFICATION_ID = 4101
        private const val POLL_MS = 1000L
        private const val WINDOW_MS = 10_000L

        private val foregroundEventType: Int
            get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                UsageEvents.Event.ACTIVITY_RESUMED
            } else {
                @Suppress("DEPRECATION")
                UsageEvents.Event.MOVE_TO_FOREGROUND
            }

        fun sync(context: Context) {
            val intent = Intent(context, ShieldService::class.java)
            if (ShieldRules.isEnabled(context)) {
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
