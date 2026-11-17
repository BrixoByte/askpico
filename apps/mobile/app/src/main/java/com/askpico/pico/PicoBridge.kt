package com.askpico.pico

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.util.Log
import android.webkit.JavascriptInterface
import androidx.core.view.WindowCompat
import com.askpico.pico.agent.Capabilities
import com.askpico.pico.agent.FocusPolicy
import com.askpico.pico.agent.FocusStore
import com.askpico.pico.agent.ShieldRules
import com.askpico.pico.agent.ShieldService
import org.json.JSONObject
import java.util.UUID

/**
 * window.PicoBridge — allow-listed methods exposed to the web app.
 * The web app must work fully when this bridge is absent (desktop browser).
 *
 * Milestone status: A3 core, agent, and vault methods implemented; the shield
 * lands in A7 and onboarding consent in A5.
 *
 * Every method except getAppVersion takes a per-WebView token as its first argument.
 * The token is given only to frames from Pico origins, through a document-start script
 * (see MainActivity.bridgeScript). Frames from other origins, sandboxed frames and any
 * caller without the token are refused, and so is any call while the top page is untrusted.
 */
class PicoBridge(private val activity: Activity) {

    private val context: Context get() = activity

    private fun ok(token: String?): Boolean = (activity as? MainActivity)?.isBridgeCall(token) == true

    @JavascriptInterface
    fun getAppVersion(): String = BuildConfig.VERSION_NAME

    @JavascriptInterface
    fun share(token: String?, text: String) {
        if (!ok(token)) return
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        activity.startActivity(Intent.createChooser(send, null))
    }

    @JavascriptInterface
    fun openExternal(token: String?, url: String) {
        if (!ok(token) || Uri.parse(url).scheme != "https") return
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
        }
    }

    @JavascriptInterface
    fun speak(token: String?, id: String, text: String, lang: String) {
        if (!ok(token)) return
        (activity as? MainActivity)?.speakNative(id, text, lang)
    }

    @JavascriptInterface
    fun stopSpeaking(token: String?) {
        if (!ok(token)) return
        (activity as? MainActivity)?.stopNativeSpeech()
    }

    @JavascriptInterface
    fun logMessage(token: String?, msg: String) {
        if (ok(token)) Log.d("PICO_JS_LOG", msg)
    }

    @JavascriptInterface
    fun logError(token: String?, msg: String) {
        if (ok(token)) Log.e("PICO_JS_ERROR", msg)
    }

    @JavascriptInterface
    fun openAppSettings(token: String?) {
        if (!ok(token)) return
        try {
            activity.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${activity.packageName}"))
            )
        } catch (_: Exception) {
        }
    }

    @JavascriptInterface
    fun hasCapability(token: String?, feature: String): Boolean =
        ok(token) && Capabilities.isGranted(activity, feature)

    @JavascriptInterface
    fun requestAccess(token: String?, feature: String) {
        if (!ok(token)) return
        (activity as? MainActivity)?.requestAccess(feature)
    }

    @JavascriptInterface
    fun performAction(token: String?, action: String, refsJson: String): String {
        val main = activity as? MainActivity
        if (!ok(token) || main == null) {
            return JSONObject().put("id", "").put("status", "unsupported").toString()
        }
        val id = UUID.randomUUID().toString()
        main.runAgentAction(id, action, refsJson)
        return JSONObject().put("id", id).put("status", "queued").toString()
    }

    @JavascriptInterface
    fun vaultSet(token: String?, key: String, value: String): Boolean =
        ok(token) && (activity as? MainActivity)?.vault?.set(key, value) == true

    @JavascriptInterface
    fun vaultHas(token: String?, key: String): Boolean =
        ok(token) && (activity as? MainActivity)?.vault?.has(key) == true

    @JavascriptInterface
    fun setShield(token: String?, rulesJson: String): Boolean {
        if (!ok(token)) return false
        val saved = ShieldRules.save(activity, rulesJson)
        if (saved) activity.runOnUiThread { ShieldService.sync(activity) }
        return saved
    }

    // Focus apps. Passcodes are passed in and checked here; they are never stored or returned.
    @JavascriptInterface
    fun focusStatus(token: String?): String =
        if (!ok(token)) "{}" else FocusStore.statusJson(context, System.currentTimeMillis()).toString()

    @JavascriptInterface
    fun focusSetEnabled(token: String?, enabled: Boolean) {
        if (!ok(token)) return
        FocusStore.setEnabled(context, enabled)
        activity.runOnUiThread { ShieldService.sync(activity) }
    }

    /** Returns the one-time recovery code, or "" if a passcode already exists or the passcode is too short. */
    @JavascriptInterface
    fun focusSetupPasscode(token: String?, passcode: String): String =
        if (!ok(token)) "" else FocusStore.setupPasscode(context, passcode) ?: ""

    /** Body: {"lengthMs":number,"strength":"STRICT|BALANCED|LIGHT","packages":["pkg",...]}. Returns "OK" or "ERROR". */
    @JavascriptInterface
    fun focusStart(token: String?, json: String): String {
        if (!ok(token)) return "ERROR"
        return try {
            val o = JSONObject(json)
            val strength = FocusPolicy.Strength.valueOf(o.getString("strength"))
            val arr = o.getJSONArray("packages")
            val packages = (0 until arr.length()).map { arr.getString(it) }.filter { it != activity.packageName }.toSet()
            val started = FocusStore.startSession(context, o.getLong("lengthMs"), strength, packages, System.currentTimeMillis())
            if (started) activity.runOnUiThread { ShieldService.sync(activity) }
            if (started) "OK" else "ERROR"
        } catch (_: Exception) {
            "ERROR"
        }
    }

    /** Launchable apps for the Focus picker: [{"package":"...","label":"..."}], Pico excluded, sorted by label. */
    @JavascriptInterface
    fun listLaunchableApps(token: String?): String {
        if (!ok(token)) return "[]"
        val pm = activity.packageManager
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val apps = pm.queryIntentActivities(launcher, 0)
            .map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
            .filter { it.first != activity.packageName }
            .distinctBy { it.first }
            .sortedBy { it.second.lowercase() }
            .map { JSONObject().put("package", it.first).put("label", it.second) }
        return org.json.JSONArray(apps).toString()
    }

    @JavascriptInterface
    fun focusBeginWait(token: String?) {
        if (ok(token)) FocusStore.beginWait(context, System.currentTimeMillis())
    }

    /** Outcome names: OK, WRONG_PASSCODE, LOCKED, NO_PASSCODE, NO_SESSION, NO_UNBLOCKS, WAIT_REQUIRED. */
    @JavascriptInterface
    fun focusEarlyUnblock(token: String?, passcode: String): String {
        if (!ok(token)) return "NO_SESSION"
        val outcome = FocusStore.earlyUnblock(context, passcode, System.currentTimeMillis())
        activity.runOnUiThread { ShieldService.sync(activity) }
        return outcome.name
    }

    @JavascriptInterface
    fun focusEmergency(token: String?, passcode: String): String {
        if (!ok(token)) return "NO_SESSION"
        val outcome = FocusStore.emergency(context, passcode, System.currentTimeMillis())
        activity.runOnUiThread { ShieldService.sync(activity) }
        return outcome.name
    }

    @JavascriptInterface
    fun focusRecover(token: String?, recoveryCode: String, newPasscode: String): Boolean =
        ok(token) && FocusStore.recover(context, recoveryCode, newPasscode)

    @JavascriptInterface
    fun focusRequestAccountReset(token: String?, newPasscode: String): Boolean =
        ok(token) && FocusStore.requestAccountReset(context, newPasscode, System.currentTimeMillis())

    @JavascriptInterface
    fun setSystemBars(token: String?, darkBackground: Boolean) {
        if (!ok(token)) return
        // darkBackground=true → light system-bar icons (for dark theme).
        activity.runOnUiThread {
            WindowCompat.getInsetsController(activity.window, activity.window.decorView)
                ?.let { controller ->
                    controller.isAppearanceLightStatusBars = !darkBackground
                    controller.isAppearanceLightNavigationBars = !darkBackground
                }
        }
    }

    @JavascriptInterface
    fun startVoiceInput(token: String?, language: String) {
        if (!ok(token)) return
        (activity as? MainActivity)?.startVoiceInput(language)
    }

    @JavascriptInterface
    fun stopVoiceInput(token: String?) {
        if (!ok(token)) return
        (activity as? MainActivity)?.stopVoiceInput()
    }
}
