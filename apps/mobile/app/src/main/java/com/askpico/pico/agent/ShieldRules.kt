package com.askpico.pico.agent

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Whole-app distraction shield rules. Plain preferences: package names are not
 * sensitive. Pico's own package is always excluded.
 */
object ShieldRules {

    private const val PREFS = "pico_shield"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_PACKAGES = "packages"
    private const val MAX_PACKAGES = 50
    private val PACKAGE_PATTERN = Regex("^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+$")

    fun isEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ENABLED, false)

    fun blockedPackages(context: Context): Set<String> =
        prefs(context).getStringSet(KEY_PACKAGES, emptySet()).orEmpty()

    /** Validates and saves rules from the web. Returns false when the JSON is malformed. */
    fun save(context: Context, rulesJson: String): Boolean {
        val json = try {
            JSONObject(rulesJson)
        } catch (_: Exception) {
            return false
        }
        val packages = parsePackages(json.optJSONArray("packages") ?: JSONArray())
            ?.filter { it != context.packageName }
            ?.toSet()
            ?: return false
        prefs(context).edit()
            .putBoolean(KEY_ENABLED, json.optBoolean(KEY_ENABLED, false))
            .putStringSet(KEY_PACKAGES, packages)
            .apply()
        return true
    }

    private fun parsePackages(array: JSONArray): List<String>? {
        if (array.length() > MAX_PACKAGES) return null
        val out = mutableListOf<String>()
        for (i in 0 until array.length()) {
            val pkg = array.optString(i)
            if (!PACKAGE_PATTERN.matches(pkg)) return null
            out.add(pkg)
        }
        return out
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
