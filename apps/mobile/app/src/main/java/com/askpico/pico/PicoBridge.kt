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
