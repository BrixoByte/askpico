package com.askpico.pico.agent

import android.Manifest
import android.app.Activity
import android.app.AppOpsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import androidx.core.content.ContextCompat

object Capabilities {

    fun runtimePermission(feature: String): String? = when (feature) {
        "microphone" -> Manifest.permission.RECORD_AUDIO
        "phone" -> Manifest.permission.CALL_PHONE
        "notifications" ->
            if (Build.VERSION.SDK_INT >= 33) Manifest.permission.POST_NOTIFICATIONS else null
        else -> null
    }

    fun isGranted(activity: Activity, feature: String): Boolean {
        if (feature == "notifications" && Build.VERSION.SDK_INT < 33) return true
        if (feature == "overlay") return Settings.canDrawOverlays(activity)
        if (feature == "usage") return hasUsageAccess(activity)
        val permission = runtimePermission(feature) ?: return false
        return ContextCompat.checkSelfPermission(activity, permission) ==
            PackageManager.PERMISSION_GRANTED
    }

    fun hasUsageAccess(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= 29) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }
}
