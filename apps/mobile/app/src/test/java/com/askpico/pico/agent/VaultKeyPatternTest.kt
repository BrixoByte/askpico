package com.askpico.pico.agent

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// KEY_PATTERN is a pure regex in the VaultStore companion — testable on the JVM.
class VaultKeyPatternTest {

    @Test
    fun `valid refs pass`() {
        assertTrue(VaultStore.KEY_PATTERN.matches("contact:ref_7f3"))
        assertTrue(VaultStore.KEY_PATTERN.matches("note:ref_91c"))
        assertTrue(VaultStore.KEY_PATTERN.matches("credential:ref_ab12CD"))
        assertTrue(VaultStore.KEY_PATTERN.matches("id:ref_x"))
        assertTrue(VaultStore.KEY_PATTERN.matches("other:ref_${"a".repeat(32)}"))
    }

    @Test
    fun `malformed refs are rejected`() {
        assertFalse(VaultStore.KEY_PATTERN.matches(""))
        assertFalse(VaultStore.KEY_PATTERN.matches("contact:7f3"))            // missing ref_
        assertFalse(VaultStore.KEY_PATTERN.matches("contact:ref_"))           // empty id
        assertFalse(VaultStore.KEY_PATTERN.matches("contact:ref_${"a".repeat(33)}")) // too long
        assertFalse(VaultStore.KEY_PATTERN.matches("evil:ref_7f3"))           // unknown kind
        assertFalse(VaultStore.KEY_PATTERN.matches("contact:ref_7f3 OR 1=1")) // injection
        assertFalse(VaultStore.KEY_PATTERN.matches("contact:ref_7f-"))        // bad chars
        assertFalse(VaultStore.KEY_PATTERN.matches("contact:ref_7f3\n"))      // newline
    }
}
