package com.askpico.pico.agent

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

/**
 * Pico Vault v1 — strictly local, Keystore-backed encrypted key/value store.
 * Values are referenced by opaque IDs (`contact:ref_…`, `note:ref_…`). Nothing
 * here is ever returned to the web layer; only the action executor resolves refs.
 */
class VaultStore(context: Context) {

    private val prefs: SharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            FILE_NAME,
            MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC),
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun set(key: String, value: String): Boolean {
        if (!KEY_PATTERN.matches(key) || value.isEmpty() || value.length > MAX_VALUE) return false
        return prefs.edit().putString(key, value).commit()
    }

    fun has(key: String): Boolean = KEY_PATTERN.matches(key) && prefs.contains(key)

    fun resolve(key: String): String? =
        if (KEY_PATTERN.matches(key)) prefs.getString(key, null) else null

    companion object {
        private const val FILE_NAME = "pico_vault"
        private const val MAX_VALUE = 4000
        val KEY_PATTERN = Regex("^(contact|note|credential|id|other):ref_[A-Za-z0-9]{1,32}$")
    }
}
