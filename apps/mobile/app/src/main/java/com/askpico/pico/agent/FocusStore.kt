package com.askpico.pico.agent

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Focus-session state on this device. Passcode and recovery code are stored only as salted
 * hashes. Nothing here is sent to the server.
 */
object FocusStore {

    enum class Outcome { OK, WRONG_PASSCODE, LOCKED, NO_PASSCODE, NO_SESSION, NO_UNBLOCKS, WAIT_REQUIRED, NO_WAIT }

    private const val PREFS = "pico_focus"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_SESSION = "session"
    private const val KEY_PASS_SALT = "pass_salt"
    private const val KEY_PASS_HASH = "pass_hash"
    private const val KEY_REC_SALT = "rec_salt"
    private const val KEY_REC_HASH = "rec_hash"
    private const val KEY_FAILS = "fails"
    private const val KEY_LOCK_UNTIL = "lock_until"
    private const val KEY_WAIT_AT = "wait_at"
    private const val KEY_PENDING_SALT = "pending_salt"
    private const val KEY_PENDING_HASH = "pending_hash"
    private const val KEY_PENDING_AT = "pending_at"
    private const val MIN_PASSCODE_LENGTH = 4

    fun isEnabled(context: Context): Boolean = prefs(context).getBoolean(KEY_ENABLED, false)

    fun setEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    fun session(context: Context): FocusSession? {
        val raw = prefs(context).getString(KEY_SESSION, null) ?: return null
        return try {
            val o = JSONObject(raw)
            FocusSession(
                startMs = o.getLong("startMs"),
                endMs = o.getLong("endMs"),
                strength = FocusPolicy.Strength.valueOf(o.getString("strength")),
                packages = o.getJSONArray("packages").let { a -> (0 until a.length()).map { a.getString(it) }.toSet() },
                unblocksUsed = o.getInt("unblocksUsed"),
                score = o.getInt("score"),
                tempUnblockUntilMs = o.getLong("tempUnblockUntilMs"),
                ended = o.getBoolean("ended"),
                history = o.getJSONArray("history").let { a -> (0 until a.length()).map { a.getString(it) } },
            )
        } catch (_: Exception) {
            null
        }
    }

    fun saveSession(context: Context, s: FocusSession) {
        val packages = JSONArray(s.packages.toList())
        val history = JSONArray(s.history)
        val json = JSONObject()
            .put("startMs", s.startMs)
            .put("endMs", s.endMs)
            .put("strength", s.strength.name)
            .put("packages", packages)
            .put("unblocksUsed", s.unblocksUsed)
            .put("score", s.score)
            .put("tempUnblockUntilMs", s.tempUnblockUntilMs)
            .put("ended", s.ended)
            .put("history", history)
        prefs(context).edit().putString(KEY_SESSION, json.toString()).apply()
    }

    fun hasPasscode(context: Context): Boolean = prefs(context).contains(KEY_PASS_HASH)

    /** First session setup: sets the passcode and returns a one-time recovery code. The caller shows it once. */
    fun setupPasscode(context: Context, passcode: String): String? {
        if (passcode.length < MIN_PASSCODE_LENGTH || hasPasscode(context)) return null
        val recovery = FocusPolicy.newRecoveryCode()
        val recSalt = FocusPolicy.newSalt()
        storePasscode(context, passcode)
        prefs(context).edit()
            .putString(KEY_REC_SALT, hex(recSalt))
            .putString(KEY_REC_HASH, FocusPolicy.hashSecret(FocusPolicy.normalizeRecoveryCode(recovery), recSalt))
            .apply()
        return recovery
    }

    /** Checks the passcode. Three wrong tries start a cool-down that doubles on each further failure. */
    fun verifyPasscode(context: Context, passcode: String, nowMs: Long): Outcome {
        applyPendingReset(context, nowMs)
        if (!hasPasscode(context)) return Outcome.NO_PASSCODE
        val p = prefs(context)
        if (nowMs < p.getLong(KEY_LOCK_UNTIL, 0L)) return Outcome.LOCKED
        val salt = unhex(p.getString(KEY_PASS_SALT, "")!!)
        return if (FocusPolicy.verifySecret(passcode, salt, p.getString(KEY_PASS_HASH, "")!!)) {
            p.edit().putInt(KEY_FAILS, 0).putLong(KEY_LOCK_UNTIL, 0L).apply()
            Outcome.OK
        } else {
            val fails = p.getInt(KEY_FAILS, 0) + 1
            p.edit()
                .putInt(KEY_FAILS, fails)
                .putLong(KEY_LOCK_UNTIL, nowMs + FocusPolicy.cooldownMs(fails))
                .apply()
            Outcome.WRONG_PASSCODE
        }
    }

    /** Recovery code resets the passcode immediately. The code itself is never shown again. */
    fun recover(context: Context, recoveryCode: String, newPasscode: String): Boolean {
        val p = prefs(context)
        if (newPasscode.length < MIN_PASSCODE_LENGTH || !p.contains(KEY_REC_HASH)) return false
        val salt = unhex(p.getString(KEY_REC_SALT, "")!!)
        val ok = FocusPolicy.verifySecret(FocusPolicy.normalizeRecoveryCode(recoveryCode), salt, p.getString(KEY_REC_HASH, "")!!)
        if (!ok) return false
        storePasscode(context, newPasscode)
        p.edit().putInt(KEY_FAILS, 0).putLong(KEY_LOCK_UNTIL, 0L).apply()
        return true
    }

    /** Signed-in account reset: takes effect only after 24 hours, so it cannot end an active session at once. */
    fun requestAccountReset(context: Context, newPasscode: String, nowMs: Long): Boolean {
        if (newPasscode.length < MIN_PASSCODE_LENGTH) return false
        val salt = FocusPolicy.newSalt()
        prefs(context).edit()
            .putString(KEY_PENDING_SALT, hex(salt))
            .putString(KEY_PENDING_HASH, FocusPolicy.hashSecret(newPasscode, salt))
            .putLong(KEY_PENDING_AT, nowMs + FocusPolicy.RESET_DELAY_MS)
            .apply()
        return true
    }

    private fun applyPendingReset(context: Context, nowMs: Long) {
        val p = prefs(context)
        if (!p.contains(KEY_PENDING_AT) || nowMs < p.getLong(KEY_PENDING_AT, 0L)) return
        p.edit()
            .putString(KEY_PASS_SALT, p.getString(KEY_PENDING_SALT, null))
            .putString(KEY_PASS_HASH, p.getString(KEY_PENDING_HASH, null))
            .remove(KEY_PENDING_SALT).remove(KEY_PENDING_HASH).remove(KEY_PENDING_AT)
            .putInt(KEY_FAILS, 0).putLong(KEY_LOCK_UNTIL, 0L)
            .apply()
    }

    fun startSession(context: Context, lengthMs: Long, strength: FocusPolicy.Strength, packages: Set<String>, nowMs: Long): Boolean {
        if (!hasPasscode(context) || !FocusPolicy.isValidPreset(lengthMs) || packages.isEmpty() || session(context)?.isActive(nowMs) == true) return false
        saveSession(context, FocusSession(nowMs, nowMs + lengthMs, strength, packages))
        return true
    }

    /** Starts the 60-second wait (Strict early unblock and every emergency). */
    fun beginWait(context: Context, nowMs: Long) {
        prefs(context).edit().putLong(KEY_WAIT_AT, nowMs).apply()
    }

    fun earlyUnblock(context: Context, passcode: String, nowMs: Long): Outcome {
        val s = session(context)?.takeIf { it.isActive(nowMs) } ?: return Outcome.NO_SESSION
        if (!s.canUseUnblock()) return Outcome.NO_UNBLOCKS
        val gate = gateCheck(context, passcode, nowMs, s.strength.waitMs)
        if (gate != Outcome.OK) return gate
        saveSession(context, s.earlyUnblock(nowMs))
        return Outcome.OK
    }

    fun emergency(context: Context, passcode: String, nowMs: Long): Outcome {
        val s = session(context)?.takeIf { it.isActive(nowMs) } ?: return Outcome.NO_SESSION
        if (!s.canUseUnblock()) return Outcome.NO_UNBLOCKS
        val gate = gateCheck(context, passcode, nowMs, FocusPolicy.EMERGENCY_WAIT_MS)
        if (gate != Outcome.OK) return gate
        saveSession(context, s.emergencyEnd(nowMs))
        return Outcome.OK
    }

    private fun gateCheck(context: Context, passcode: String, nowMs: Long, waitMs: Long): Outcome {
        val waitAt = prefs(context).getLong(KEY_WAIT_AT, -1L)
        if (waitMs > 0 && (waitAt < 0 || nowMs - waitAt < waitMs)) return Outcome.WAIT_REQUIRED
        return verifyPasscode(context, passcode, nowMs)
    }

    /** Packages to cover right now. Empty when focus is off, no session is running, or an early-unblock window is open. */
    fun blockedPackages(context: Context, nowMs: Long): Set<String> {
        if (!isEnabled(context)) return emptySet()
        val s = session(context) ?: return emptySet()
        return if (s.isBlocking(nowMs)) s.packages else emptySet()
    }

    /** Session status for the web UI. Contains no passcode, hash or salt. */
    fun statusJson(context: Context, nowMs: Long): JSONObject {
        val s = session(context)
        val p = prefs(context)
        val o = JSONObject()
            .put("enabled", isEnabled(context))
            .put("hasPasscode", hasPasscode(context))
            .put("lockRemainingMs", maxOf(0L, p.getLong(KEY_LOCK_UNTIL, 0L) - nowMs))
        if (s != null) {
            o.put("active", s.isActive(nowMs))
                .put("blocking", s.isBlocking(nowMs))
                .put("endMs", s.endMs)
                .put("strength", s.strength.name)
                .put("score", s.score)
                .put("unblocksUsed", s.unblocksUsed)
                .put("unblocksLeft", s.remainingUnblocks())
                .put("packages", JSONArray(s.packages.toList()))
        }
        return o
    }

    private fun storePasscode(context: Context, passcode: String) {
        val salt = FocusPolicy.newSalt()
        prefs(context).edit()
            .putString(KEY_PASS_SALT, hex(salt))
            .putString(KEY_PASS_HASH, FocusPolicy.hashSecret(passcode, salt))
            .apply()
    }

    private fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }

    private fun unhex(s: String): ByteArray = ByteArray(s.length / 2) { s.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
