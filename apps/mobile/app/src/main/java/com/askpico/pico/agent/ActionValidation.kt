package com.askpico.pico.agent

/**
 * Pure validation rules for device actions, split out of ActionExecutor so the
 * rules are unit-testable without an Activity. Model-originated intents and
 * user input go through exactly the same checks.
 */
object ActionValidation {

    private val PHONE_PATTERN = Regex("^\\+?[0-9]{3,20}$")
    private val PACKAGE_PATTERN = Regex("^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+$")

    val APP_ALLOWLIST: Set<String> = setOf(
        "com.whatsapp",
        "com.instagram.android",
        "com.google.android.youtube",
        "com.zhiliaoapp.musically",
        "com.facebook.katana",
        "com.android.chrome"
    )

    fun isValidPhone(number: String): Boolean = PHONE_PATTERN.matches(number)

    fun isAllowedApp(pkg: String): Boolean = pkg in APP_ALLOWLIST

    /** Only http/https URLs may leave the app — javascript:, file:, content: are refused. */
    fun isWebUrl(scheme: String?): Boolean = scheme == "https" || scheme == "http"

    fun isValidPackageName(pkg: String): Boolean = PACKAGE_PATTERN.matches(pkg)

    /** Shows only the last two digits: "+92•••67". */
    fun mask(number: String): String =
        "\u2022".repeat((number.length - 2).coerceAtLeast(0)) + number.takeLast(2)
}
