package com.askpico.pico.agent

import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * Pure focus-session rules. No Android types, so every rule is covered by JVM unit tests.
 * Owner decisions (Round 33) are encoded here; change them only with the owner.
 */
object FocusPolicy {
    const val MINUTE_MS = 60_000L
    const val HOUR_MS = 60 * MINUTE_MS
    const val DAY_MS = 24 * HOUR_MS
    const val WEEK_MS = 7 * DAY_MS

    /** Presets the user can pick when a session starts. Maximum 7 days. */
    val PRESETS_MS = listOf(HOUR_MS, DAY_MS, WEEK_MS)

    const val UNBLOCK_WINDOW_MS = 10 * MINUTE_MS
    const val EMERGENCY_WAIT_MS = MINUTE_MS
    const val EARLY_SCORE_COST = 10
    const val EMERGENCY_SCORE_COST = 25
    const val START_SCORE = 100

    const val RESET_DELAY_MS = DAY_MS
    const val FAILS_BEFORE_COOLDOWN = 3
    const val BASE_COOLDOWN_MS = MINUTE_MS
    const val MAX_COOLDOWN_MS = 15 * MINUTE_MS

    private const val KDF_ITERATIONS = 120_000
    private const val KEY_BITS = 256
    private const val RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

    enum class Strength(val maxUnblocks: Int, val waitMs: Long) {
        STRICT(1, MINUTE_MS),
        BALANCED(2, 0L),
        LIGHT(5, 0L),
    }

    /** Cool-down after wrong passcode attempts: 3 fails = 60 s, each further fail doubles, capped at 15 min. */
    fun cooldownMs(failures: Int): Long {
        if (failures < FAILS_BEFORE_COOLDOWN) return 0L
        val shift = minOf(failures - FAILS_BEFORE_COOLDOWN, 20)
        return minOf(BASE_COOLDOWN_MS shl shift, MAX_COOLDOWN_MS)
    }

    fun isValidPreset(durationMs: Long): Boolean = durationMs in PRESETS_MS

    fun newSalt(random: SecureRandom = SecureRandom()): ByteArray = ByteArray(16).also { random.nextBytes(it) }

    /** Salted PBKDF2-HMAC-SHA256 hash, returned as hex. Plain text is never stored. */
    fun hashSecret(secret: String, salt: ByteArray): String {
        val spec = PBEKeySpec(secret.toCharArray(), salt, KDF_ITERATIONS, KEY_BITS)
        try {
            val bytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
            return bytes.joinToString("") { "%02x".format(it) }
        } finally {
            spec.clearPassword()
        }
    }

    fun verifySecret(secret: String, salt: ByteArray, expectedHex: String): Boolean =
        MessageDigest.isEqual(hashSecret(secret, salt).toByteArray(), expectedHex.toByteArray())

    /** One-time recovery code, shown once as XXXX-XXXX-XXXX-XXXX. Ambiguous characters are left out. */
    fun newRecoveryCode(random: SecureRandom = SecureRandom()): String =
        (0 until 16).map { RECOVERY_ALPHABET[random.nextInt(RECOVERY_ALPHABET.length)] }
            .chunked(4).joinToString("-") { it.joinToString("") }

    fun normalizeRecoveryCode(input: String): String =
        input.uppercase().filter { it in RECOVERY_ALPHABET }
}

/** One focus session. Only extendable; there is no shorten or edit. */
data class FocusSession(
    val startMs: Long,
    val endMs: Long,
    val strength: FocusPolicy.Strength,
    val packages: Set<String>,
    val unblocksUsed: Int = 0,
    val score: Int = FocusPolicy.START_SCORE,
    val tempUnblockUntilMs: Long = 0L,
    val ended: Boolean = false,
    val history: List<String> = emptyList(),
) {
    fun isActive(nowMs: Long): Boolean = !ended && nowMs < endMs

    /** Blocks apply while the session is active and no early-unblock window is open. */
    fun isBlocking(nowMs: Long): Boolean = isActive(nowMs) && nowMs >= tempUnblockUntilMs

    fun canUseUnblock(): Boolean = unblocksUsed < strength.maxUnblocks

    fun remainingUnblocks(): Int = (strength.maxUnblocks - unblocksUsed).coerceAtLeast(0)

    /** Adds time. Never shortens: a non-positive or over-limit extension is rejected. */
    fun extendBy(extraMs: Long): FocusSession {
        require(extraMs > 0) { "extension must be positive" }
        val newEnd = endMs + extraMs
        require(newEnd - startMs <= FocusPolicy.WEEK_MS) { "session may not exceed 7 days" }
        return copy(endMs = newEnd)
    }

    /** Early unblock: 10-minute window, fixed score cost. Caller checks [canUseUnblock] and the wait. */
    fun earlyUnblock(nowMs: Long): FocusSession {
        require(canUseUnblock()) { "no unblocks left" }
        return copy(
            unblocksUsed = unblocksUsed + 1,
            score = (score - FocusPolicy.EARLY_SCORE_COST).coerceAtLeast(0),
            tempUnblockUntilMs = nowMs + FocusPolicy.UNBLOCK_WINDOW_MS,
            history = history + "early:$nowMs",
        )
    }

    /** Emergency ends the session now. Same count as early unblock, larger score cost. */
    fun emergencyEnd(nowMs: Long): FocusSession {
        require(canUseUnblock()) { "no unblocks left" }
        return copy(
            unblocksUsed = unblocksUsed + 1,
            score = (score - FocusPolicy.EMERGENCY_SCORE_COST).coerceAtLeast(0),
            endMs = minOf(endMs, nowMs),
            ended = true,
            history = history + "emergency:$nowMs",
        )
    }

    /** Wait gate for early unblock (Strict only) and emergency (all strengths). */
    fun waitDone(requestedAtMs: Long, nowMs: Long, waitMs: Long): Boolean = nowMs - requestedAtMs >= waitMs
}
