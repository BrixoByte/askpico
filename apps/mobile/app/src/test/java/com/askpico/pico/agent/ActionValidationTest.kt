package com.askpico.pico.agent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// Pure-JVM tests for the action validation rules shared by user-typed and
// model-originated intents (both go through ActionExecutor -> ActionValidation).
class ActionValidationTest {

    // ── Phone numbers ──────────────────────────────────────────────────────

    @Test
    fun `valid phone numbers pass`() {
        assertTrue(ActionValidation.isValidPhone("+923001234567"))
        assertTrue(ActionValidation.isValidPhone("03001234567"))
        assertTrue(ActionValidation.isValidPhone("911"))
    }

    @Test
    fun `non-numeric and malformed numbers are rejected`() {
        assertFalse(ActionValidation.isValidPhone(""))
        assertFalse(ActionValidation.isValidPhone("+92"))
        assertFalse(ActionValidation.isValidPhone("call mom"))
        assertFalse(ActionValidation.isValidPhone("0300-1234567"))
        assertFalse(ActionValidation.isValidPhone("+92 300 1234567"))
        assertFalse(ActionValidation.isValidPhone("1".repeat(21)))
        assertFalse(ActionValidation.isValidPhone("javascript:alert(1)"))
    }

    // ── App allowlist ──────────────────────────────────────────────────────

    @Test
    fun `allowlisted packages pass`() {
        ActionValidation.APP_ALLOWLIST.forEach { pkg ->
            assertTrue("$pkg should be allowed", ActionValidation.isAllowedApp(pkg))
        }
    }

    @Test
    fun `non-listed packages are rejected`() {
        assertFalse(ActionValidation.isAllowedApp("com.google.android.gm"))
        assertFalse(ActionValidation.isAllowedApp("com.whatsapp.w4b"))
        assertFalse(ActionValidation.isAllowedApp(""))
        assertFalse(ActionValidation.isAllowedApp("com.whatsapp ")) // trailing space
        // Pico's own package must never be launchable through the action layer.
        assertFalse(ActionValidation.isAllowedApp("com.askpico.pico"))
    }

    // ── URL schemes ────────────────────────────────────────────────────────

    @Test
    fun `http and https are allowed`() {
        assertTrue(ActionValidation.isWebUrl("https"))
        assertTrue(ActionValidation.isWebUrl("http"))
    }

    @Test
    fun `dangerous schemes are rejected`() {
        for (scheme in listOf("javascript", "file", "content", "data", "intent", "tel", "mailto", null)) {
            assertFalse("$scheme must be rejected", ActionValidation.isWebUrl(scheme))
        }
    }

    // ── Package-name shape ─────────────────────────────────────────────────

    @Test
    fun `package name pattern`() {
        assertTrue(ActionValidation.isValidPackageName("com.whatsapp"))
        assertTrue(ActionValidation.isValidPackageName("com.google.android.youtube"))
        assertFalse(ActionValidation.isValidPackageName("whatsapp"))
        assertFalse(ActionValidation.isValidPackageName("com..whatsapp"))
        assertFalse(ActionValidation.isValidPackageName("com.whatsapp/extra"))
        assertFalse(ActionValidation.isValidPackageName("com.whatsapp?x=1"))
        assertFalse(ActionValidation.isValidPackageName(""))
    }

    // ── Masking ────────────────────────────────────────────────────────────

    @Test
    fun `mask shows only the last two digits`() {
        assertEquals("•••••••••••67", ActionValidation.mask("+923001234567"))
        assertFalse(ActionValidation.mask("+923001234567").contains("300"))
        assertEquals("67", ActionValidation.mask("67")) // nothing hidden at length 2
        assertEquals("", ActionValidation.mask(""))
    }
}
