package com.askpico.pico

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LoadErrorClassifierTest {

    // ── Connectivity always wins ────────────────────────────────────────────

    @Test
    fun `any error code while offline classifies as OFFLINE`() {
        for (code in intArrayOf(
            LoadErrorCodes.UNKNOWN,
            LoadErrorCodes.HOST_LOOKUP,
            LoadErrorCodes.CONNECT,
            LoadErrorCodes.IO,
            LoadErrorCodes.TIMEOUT,
            LoadErrorCodes.FAILED_SSL,
        )) {
            assertEquals(LoadErrorState.OFFLINE, LoadErrorClassifier.fromErrorCode(code, isOnline = false))
        }
    }

    @Test
    fun `watchdog while offline classifies as OFFLINE`() {
        assertEquals(LoadErrorState.OFFLINE, LoadErrorClassifier.fromWatchdogTimeout(isOnline = false))
    }

    @Test
    fun `ssl error while offline classifies as OFFLINE`() {
        assertEquals(LoadErrorState.OFFLINE, LoadErrorClassifier.fromSslError(isOnline = false))
    }

    // ── Server unreachable ──────────────────────────────────────────────────

    @Test
    fun `host lookup while online is SERVER_UNREACHABLE`() {
        assertEquals(
            LoadErrorState.SERVER_UNREACHABLE,
            LoadErrorClassifier.fromErrorCode(LoadErrorCodes.HOST_LOOKUP, isOnline = true),
        )
    }

    @Test
    fun `connect refused while online is SERVER_UNREACHABLE`() {
        assertEquals(
            LoadErrorState.SERVER_UNREACHABLE,
            LoadErrorClassifier.fromErrorCode(LoadErrorCodes.CONNECT, isOnline = true),
        )
    }

    @Test
    fun `io and ssl handshake while online are SERVER_UNREACHABLE`() {
        assertEquals(
            LoadErrorState.SERVER_UNREACHABLE,
            LoadErrorClassifier.fromErrorCode(LoadErrorCodes.IO, isOnline = true),
        )
        assertEquals(
            LoadErrorState.SERVER_UNREACHABLE,
            LoadErrorClassifier.fromErrorCode(LoadErrorCodes.FAILED_SSL, isOnline = true),
        )
    }

    @Test
    fun `unknown error while online is SERVER_UNREACHABLE`() {
        assertEquals(
            LoadErrorState.SERVER_UNREACHABLE,
            LoadErrorClassifier.fromErrorCode(LoadErrorCodes.UNKNOWN, isOnline = true),
        )
    }

    @Test
    fun `ssl error while online is SERVER_UNREACHABLE`() {
        assertEquals(LoadErrorState.SERVER_UNREACHABLE, LoadErrorClassifier.fromSslError(isOnline = true))
    }

    // ── Timeout ─────────────────────────────────────────────────────────────

    @Test
    fun `timeout code while online is TIMEOUT`() {
        assertEquals(
            LoadErrorState.TIMEOUT,
            LoadErrorClassifier.fromErrorCode(LoadErrorCodes.TIMEOUT, isOnline = true),
        )
    }

    @Test
    fun `watchdog while online is TIMEOUT`() {
        assertEquals(LoadErrorState.TIMEOUT, LoadErrorClassifier.fromWatchdogTimeout(isOnline = true))
    }

    // ── HTTP status ─────────────────────────────────────────────────────────

    @Test
    fun `http 5xx is SERVER_ERROR`() {
        for (status in intArrayOf(500, 502, 503, 520)) {
            assertEquals(LoadErrorState.SERVER_ERROR, LoadErrorClassifier.fromHttpStatus(status))
        }
    }

    @Test
    fun `http 4xx and below are ignored`() {
        for (status in intArrayOf(400, 401, 403, 404, 499)) {
            assertNull(LoadErrorClassifier.fromHttpStatus(status))
        }
    }
}

class RetryGateTest {

    @Test
    fun `debounce blocks stacked retries until finish`() {
        val gate = RetryGate()
        assertTrue(gate.beginRetry())
        assertFalse(gate.beginRetry()) // second tap while in flight
        gate.finish()
        assertTrue(gate.beginRetry()) // next attempt allowed after finish
    }

    @Test
    fun `auto retry fires once per screen`() {
        val gate = RetryGate()
        assertTrue(gate.beginAutoRetry())
        assertFalse(gate.beginAutoRetry()) // second connectivity flip must not reload again
        gate.resetAutoRetry()
        assertTrue(gate.beginAutoRetry()) // a fresh error screen may auto-retry again
    }

    @Test
    fun `auto retry does not fire while a manual retry is in flight`() {
        val gate = RetryGate()
        assertTrue(gate.beginRetry())
        assertFalse(gate.beginAutoRetry())
    }
}
