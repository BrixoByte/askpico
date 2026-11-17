package com.askpico.pico.agent

import com.askpico.pico.agent.FocusPolicy.Strength
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.Assert.assertThrows

class FocusPolicyTest {

    private val t0 = 1_000_000_000L
    private fun session(strength: Strength = Strength.BALANCED, lengthMs: Long = FocusPolicy.HOUR_MS) =
        FocusSession(startMs = t0, endMs = t0 + lengthMs, strength = strength, packages = setOf("com.whatsapp"))

    @Test
    fun presets_areOnlyOneHourOneDayOneWeek() {
        assertTrue(FocusPolicy.isValidPreset(FocusPolicy.HOUR_MS))
        assertTrue(FocusPolicy.isValidPreset(FocusPolicy.DAY_MS))
        assertTrue(FocusPolicy.isValidPreset(FocusPolicy.WEEK_MS))
        assertFalse(FocusPolicy.isValidPreset(2 * FocusPolicy.HOUR_MS))
        assertFalse(FocusPolicy.isValidPreset(FocusPolicy.WEEK_MS + 1))
    }

    @Test
    fun extendBy_addsTime_andRejectsMoreThanSevenDays() {
        val extended = session(lengthMs = FocusPolicy.DAY_MS).extendBy(FocusPolicy.HOUR_MS)
        assertEquals(t0 + FocusPolicy.DAY_MS + FocusPolicy.HOUR_MS, extended.endMs)
        assertThrows(IllegalArgumentException::class.java) {
            session(lengthMs = FocusPolicy.WEEK_MS).extendBy(1)
        }
    }

    @Test
    fun extendBy_rejectsShortening() {
        assertThrows(IllegalArgumentException::class.java) { session().extendBy(-1) }
    }

    @Test
    fun session_autoEndsAtEndTime() {
        val s = session()
        assertTrue(s.isBlocking(t0 + FocusPolicy.HOUR_MS - 1))
        assertFalse(s.isBlocking(t0 + FocusPolicy.HOUR_MS))
    }

    @Test
    fun strictStrength_allowsOneUnblock_andNeedsSixtySecondWait() {
        val s = session(Strength.STRICT)
        assertEquals(1, s.remainingUnblocks())
        assertEquals(FocusPolicy.MINUTE_MS, Strength.STRICT.waitMs)
        assertFalse(s.waitDone(requestedAtMs = t0, nowMs = t0 + 59_999, waitMs = Strength.STRICT.waitMs))
        assertTrue(s.waitDone(requestedAtMs = t0, nowMs = t0 + 60_000, waitMs = Strength.STRICT.waitMs))
    }

    @Test
    fun balancedStrength_allowsTwoUnblocks_withoutWait() {
        val s = session(Strength.BALANCED)
        assertEquals(2, s.remainingUnblocks())
        assertEquals(0L, Strength.BALANCED.waitMs)
    }

    @Test
    fun lightStrength_allowsFiveUnblocks_withoutWait() {
        assertEquals(5, session(Strength.LIGHT).remainingUnblocks())
        assertEquals(0L, Strength.LIGHT.waitMs)
    }

    @Test
    fun earlyUnblock_countIsLimitedPerStrength() {
        var s = session(Strength.BALANCED)
        s = s.earlyUnblock(t0)
        s = s.earlyUnblock(t0)
        assertFalse(s.canUseUnblock())
        assertThrows(IllegalArgumentException::class.java) { s.earlyUnblock(t0) }
    }

    @Test
    fun earlyUnblock_opensTenMinuteWindow_thenBlocksAgain() {
        val s = session(Strength.LIGHT).earlyUnblock(t0)
        assertFalse(s.isBlocking(t0 + FocusPolicy.UNBLOCK_WINDOW_MS - 1))
        assertTrue(s.isBlocking(t0 + FocusPolicy.UNBLOCK_WINDOW_MS))
    }

    @Test
    fun earlyUnblock_deductsTenPoints() {
        assertEquals(90, session().earlyUnblock(t0).score)
    }

    @Test
    fun emergency_costsMoreThanEarlyUnblock_andEndsSession() {
        val s = session(Strength.LIGHT).emergencyEnd(t0 + 5)
        assertEquals(100 - FocusPolicy.EMERGENCY_SCORE_COST, s.score)
        assertTrue(FocusPolicy.EMERGENCY_SCORE_COST > FocusPolicy.EARLY_SCORE_COST)
        assertFalse(s.isBlocking(t0 + 6))
        assertTrue(s.history.single().startsWith("emergency:"))
    }

    @Test
    fun emergency_sharesCountWithEarlyUnblock() {
        val s = session(Strength.BALANCED).earlyUnblock(t0)
        val afterEmergency = s.emergencyEnd(t0)
        assertEquals(2, afterEmergency.unblocksUsed)
        assertFalse(afterEmergency.canUseUnblock())
    }

    @Test
    fun emergencyWait_isSixtySeconds_forAllStrengths() {
        assertEquals(FocusPolicy.EMERGENCY_WAIT_MS, 60_000L)
        assertEquals(60_000L, FocusPolicy.EMERGENCY_WAIT_MS)
    }

    @Test
    fun scoreHistory_recordsEarlyUnblocks() {
        val s = session(Strength.LIGHT).earlyUnblock(t0).earlyUnblock(t0 + 1)
        assertEquals(2, s.history.size)
        assertEquals(80, s.score)
    }

    @Test
    fun cooldown_startsAfterThreeWrongTries_andDoubles() {
        assertEquals(0L, FocusPolicy.cooldownMs(2))
        assertEquals(60_000L, FocusPolicy.cooldownMs(3))
        assertEquals(120_000L, FocusPolicy.cooldownMs(4))
        assertEquals(240_000L, FocusPolicy.cooldownMs(5))
    }

    @Test
    fun cooldown_isCappedAtFifteenMinutes() {
        assertEquals(FocusPolicy.MAX_COOLDOWN_MS, FocusPolicy.cooldownMs(7))
        assertEquals(FocusPolicy.MAX_COOLDOWN_MS, FocusPolicy.cooldownMs(50))
    }

    @Test
    fun passcode_hashAndVerify_withSalt() {
        val salt = FocusPolicy.newSalt()
        val hash = FocusPolicy.hashSecret("test-passcode-1", salt)
        assertTrue(FocusPolicy.verifySecret("test-passcode-1", salt, hash))
        assertFalse(FocusPolicy.verifySecret("test-passcode-2", salt, hash))
        assertNotEquals(hash, FocusPolicy.hashSecret("test-passcode-1", FocusPolicy.newSalt()))
        assertFalse(hash.contains("test-passcode-1"))
    }

    @Test
    fun recoveryCode_formatAndNormalize() {
        val code = FocusPolicy.newRecoveryCode()
        assertEquals(19, code.length)
        assertEquals(4, code.split("-").size)
        assertEquals(code.replace("-", ""), FocusPolicy.normalizeRecoveryCode(code.lowercase()))
    }

    @Test
    fun recoveryCode_hashRoundTrip() {
        val code = FocusPolicy.newRecoveryCode()
        val salt = FocusPolicy.newSalt()
        val hash = FocusPolicy.hashSecret(FocusPolicy.normalizeRecoveryCode(code), salt)
        assertTrue(FocusPolicy.verifySecret(FocusPolicy.normalizeRecoveryCode(code.lowercase()), salt, hash))
    }

    @Test
    fun passcodeReset_delayIsTwentyFourHours() {
        assertEquals(FocusPolicy.DAY_MS, FocusPolicy.RESET_DELAY_MS)
    }
}
