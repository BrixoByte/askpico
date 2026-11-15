package com.askpico.pico.agent

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.provider.AlarmClock
import androidx.appcompat.app.AlertDialog
import com.askpico.pico.MainActivity
import org.json.JSONObject

object ActionStatus {
    const val DONE = "done"
    const val UNSUPPORTED = "unsupported"
    const val DENIED = "denied"
    const val INVALID = "invalid"
    const val CANCELLED = "cancelled"
}

class ActionExecutor(private val activity: MainActivity, private val vault: VaultStore) {

    fun run(action: String, rawArgs: JSONObject, done: (String) -> Unit) {
        val args = resolveRefs(rawArgs)
        if (args == null) {
            done(ActionStatus.INVALID)
            return
        }
        when (action) {
            "open_app" -> done(openApp(args.optString("package")))
            "open_url" -> done(openUrl(args.optString("url")))
            "set_alarm" -> done(setAlarm(args))
            "set_timer" -> done(setTimer(args))
            "share_whatsapp" -> done(shareWhatsApp(args.optString("text")))
            "call" -> confirmCall(args.optString("number"), done)
            else -> done(ActionStatus.UNSUPPORTED)
        }
    }

    private fun resolveRefs(args: JSONObject): JSONObject? {
        val out = JSONObject()
        val keys = args.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val value = args.opt(key)
            if (value is String && VaultStore.KEY_PATTERN.matches(value)) {
                out.put(key, vault.resolve(value) ?: return null)
            } else {
                out.put(key, value)
            }
        }
        return out
    }

    private fun openApp(pkg: String): String {
        if (pkg !in APP_ALLOWLIST) return ActionStatus.INVALID
        val intent = activity.packageManager.getLaunchIntentForPackage(pkg)
            ?: return ActionStatus.UNSUPPORTED
        return start(intent)
    }

    private fun openUrl(url: String): String {
        val uri = Uri.parse(url)
        if (uri.scheme != "https" && uri.scheme != "http") return ActionStatus.INVALID
        if (uri.host.isNullOrEmpty()) return ActionStatus.INVALID
        return start(Intent(Intent.ACTION_VIEW, uri))
    }

    private fun setAlarm(args: JSONObject): String {
        val hour = strictInt(args, "hour")
        val minute = strictInt(args, "minute")
        val text = label(args) ?: return ActionStatus.INVALID
        if (hour == null || minute == null || hour !in 0..23 || minute !in 0..59) return ActionStatus.INVALID
        return start(
            Intent(AlarmClock.ACTION_SET_ALARM).apply {
                putExtra(AlarmClock.EXTRA_HOUR, hour)
                putExtra(AlarmClock.EXTRA_MINUTES, minute)
                putExtra(AlarmClock.EXTRA_MESSAGE, text)
                putExtra(AlarmClock.EXTRA_SKIP_UI, true)
            }
        )
    }

    private fun setTimer(args: JSONObject): String {
        val seconds = strictInt(args, "seconds")
        val text = label(args) ?: return ActionStatus.INVALID
        if (seconds == null || seconds !in 1..MAX_TIMER_SECONDS) return ActionStatus.INVALID
        return start(
            Intent(AlarmClock.ACTION_SET_TIMER).apply {
                putExtra(AlarmClock.EXTRA_LENGTH, seconds)
                putExtra(AlarmClock.EXTRA_MESSAGE, text)
                putExtra(AlarmClock.EXTRA_SKIP_UI, true)
            }
        )
    }

    // Only JSON integers count. optInt would silently turn 1.5 into 1, and "5" or null into a number.
    private fun strictInt(args: JSONObject, key: String): Int? {
        val value = args.opt(key)
        return if (value is Int || value is Long) (value as Number).toInt() else null
    }

    private fun shareWhatsApp(text: String): String {
        if (text.isBlank() || text.length > MAX_TEXT) return ActionStatus.INVALID
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        return try {
            activity.startActivity(Intent(send).setPackage(WHATSAPP_PACKAGE))
            ActionStatus.DONE
        } catch (_: ActivityNotFoundException) {
            start(Intent.createChooser(send, null))
        }
    }

    private fun confirmCall(number: String, done: (String) -> Unit) {
        if (!PHONE_PATTERN.matches(number)) {
            done(ActionStatus.INVALID)
            return
        }
        AlertDialog.Builder(activity)
            .setTitle("Call ${mask(number)}?")
            .setPositiveButton("Call") { _, _ ->
                activity.requestPermission(Manifest.permission.CALL_PHONE) { granted ->
                    done(
                        if (granted) {
                            start(Intent(Intent.ACTION_CALL, Uri.parse("tel:$number")))
                        } else {
                            ActionStatus.DENIED
                        }
                    )
                }
            }
            .setNegativeButton("Cancel") { _, _ -> done(ActionStatus.CANCELLED) }
            .setOnCancelListener { done(ActionStatus.CANCELLED) }
            .show()
    }

    // Labels longer than MAX_LABEL code points are refused, not cut (counted by code points, so an emoji is one).
    private fun label(args: JSONObject): String? {
        val text = args.optString("label")
        return if (text.codePointCount(0, text.length) > MAX_LABEL) null else text
    }

    private fun mask(number: String): String =
        "\u2022".repeat((number.length - 2).coerceAtLeast(0)) + number.takeLast(2)

    private fun start(intent: Intent): String = try {
        activity.startActivity(intent)
        ActionStatus.DONE
    } catch (_: ActivityNotFoundException) {
        ActionStatus.UNSUPPORTED
    } catch (_: SecurityException) {
        ActionStatus.DENIED
    }

    companion object {
        private const val WHATSAPP_PACKAGE = "com.whatsapp"
        private const val MAX_TEXT = 4000
        private const val MAX_LABEL = 100
        private const val MAX_TIMER_SECONDS = 86400
        private val PHONE_PATTERN = Regex("^\\+?[0-9]{3,20}$")
        private val APP_ALLOWLIST = setOf(
            "com.whatsapp",
            "com.instagram.android",
            "com.google.android.youtube",
            "com.zhiliaoapp.musically",
            "com.facebook.katana",
            "com.android.chrome"
        )
    }
}
