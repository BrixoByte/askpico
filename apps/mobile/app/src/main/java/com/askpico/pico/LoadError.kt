package com.askpico.pico

// Failure classification for the initial WebView load. Pure Kotlin (no Android
// imports) so JVM unit tests can cover every branch; MainActivity only feeds it
// the raw callback values.
//
// WebViewClient error codes are mirrored as Int constants so this file never
// needs the framework classes at test time.

enum class LoadErrorState {
    OFFLINE,
    SERVER_UNREACHABLE,
    SERVER_ERROR,
    TIMEOUT,
}

object LoadErrorCodes {
    const val HOST_LOOKUP = -2   // WebViewClient.ERROR_HOST_LOOKUP
    const val UNSUPPORTED_AUTH = -4
    const val CONNECT = -6       // WebViewClient.ERROR_CONNECT
    const val IO = -7            // WebViewClient.ERROR_IO
    const val TIMEOUT = -8       // WebViewClient.ERROR_TIMEOUT
    const val REDIRECT_LOOP = -9
    const val UNSUPPORTED_SCHEME = -10
    const val FAILED_SSL = -11   // WebViewClient.ERROR_FAILED_SSL_HANDSHAKE
    const val UNKNOWN = -1       // WebViewClient.ERROR_UNKNOWN
}

object LoadErrorClassifier {

    /**
     * Maps a main-frame [onReceivedError] code to a UI state. Connectivity wins
     * over every code: with no validated network the truthful state is OFFLINE,
     * whatever the WebView reported.
     */
    fun fromErrorCode(errorCode: Int, isOnline: Boolean): LoadErrorState {
        if (!isOnline) return LoadErrorState.OFFLINE
        return when (errorCode) {
            LoadErrorCodes.TIMEOUT -> LoadErrorState.TIMEOUT
            LoadErrorCodes.HOST_LOOKUP,
            LoadErrorCodes.CONNECT,
            LoadErrorCodes.FAILED_SSL,
            LoadErrorCodes.IO,
            LoadErrorCodes.REDIRECT_LOOP,
            -> LoadErrorState.SERVER_UNREACHABLE
            // Unknown/auth/scheme errors while online: the device reached out
            // and the host failed — honest bucket is "server unreachable".
            else -> LoadErrorState.SERVER_UNREACHABLE
        }
    }

    /** Maps a main-frame [onReceivedHttpError] status code. Only 5xx gets the error screen. */
    fun fromHttpStatus(statusCode: Int): LoadErrorState? =
        if (statusCode >= 500) LoadErrorState.SERVER_ERROR else null

    /** SSL handshake/certificate failure on the main frame — a server-side problem. */
    fun fromSslError(isOnline: Boolean): LoadErrorState =
        if (isOnline) LoadErrorState.SERVER_UNREACHABLE else LoadErrorState.OFFLINE

    /** The load watchdog fired while online: the page is just too slow. */
    fun fromWatchdogTimeout(isOnline: Boolean): LoadErrorState =
        if (isOnline) LoadErrorState.TIMEOUT else LoadErrorState.OFFLINE
}

/**
 * Guards the Retry button and the connectivity auto-retry.
 * - Manual retry: only one in-flight load at a time; [beginRetry] must be
 *   paired with [finish] (called from onPageStarted/onReceivedError).
 * - Auto retry: fires at most once per error screen; [resetAutoRetry] runs when
 *   a fresh error screen is shown so the next outage can auto-retry again.
 */
class RetryGate {
    @Volatile var inFlight = false
        private set
    @Volatile var autoRetryUsed = false
        private set

    /** Returns true when a retry attempt may start. */
    fun beginRetry(): Boolean {
        if (inFlight) return false
        inFlight = true
        return true
    }

    fun finish() {
        inFlight = false
    }

    /** Returns true once per screen — subsequent calls return false until reset. */
    fun beginAutoRetry(): Boolean {
        if (autoRetryUsed || inFlight) return false
        autoRetryUsed = true
        return true
    }

    fun resetAutoRetry() {
        autoRetryUsed = false
    }
}
