package com.askpico.pico

import android.Manifest
import android.annotation.SuppressLint
import android.content.ComponentCallbacks2
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.askpico.pico.agent.ActionExecutor
import com.askpico.pico.agent.Capabilities
import com.askpico.pico.agent.ShieldService
import com.askpico.pico.agent.VaultStore
import org.json.JSONObject
import java.util.UUID

class MainActivity : AppCompatActivity() {

    companion object {
        // A main frame still loading after this limit is classified as TIMEOUT.
        const val LOAD_WATCHDOG_MS = 25_000L
        const val EXTRA_FORCE_ERROR = "pico_force_error"

    }

    internal lateinit var webView: WebView
    private lateinit var container: ViewGroup
    private lateinit var splash: View
    private lateinit var offline: View
    private lateinit var retryButton: Button
    private lateinit var errorIcon: ImageView
    private lateinit var errorTitle: TextView
    private lateinit var errorMessage: TextView
    private lateinit var errorHint: TextView
    private lateinit var midBanner: View
    private lateinit var midBannerText: TextView
    private val retryGate = RetryGate()
    @Volatile private var lastUrl: String = BuildConfig.WEB_URL
    // True once any main-frame page finished successfully; afterwards a failed
    // load shows the amber mid-session banner instead of the full error screen.
    @Volatile private var pageLoadedOnce = false
    @Volatile private var errorScreenActive = false
    @Volatile private var forcedError = false // debug override owns the screen
    @Volatile private var mainFrameLoading = false
    @Volatile private var mainFrameFailed = false
    private var loadWatchdog: Runnable? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    // Token that Pico-origin frames get through the document-start script. Null = bridge refuses everything.
    @Volatile private var bridgeToken: String? = null
    private val pendingCaptureRequests = mutableListOf<PermissionRequest>()

    private var pendingPermissionResult: ((Boolean) -> Unit)? = null
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val callback = pendingPermissionResult
        pendingPermissionResult = null
        callback?.invoke(granted)
    }

    // WebView <input type=file> support: WebChromeClient.onShowFileChooser hands the
    // pick to the system DocumentsUI; the result Uris go back to the page.
    private var filePathCallback: android.webkit.ValueCallback<Array<Uri>>? = null
    private var pendingFileChooserSingle = false

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments()
    ) { uris ->
        val callback = filePathCallback
        filePathCallback = null
        val single = pendingFileChooserSingle
        pendingFileChooserSingle = false
        if (uris.isNullOrEmpty()) {
            callback?.onReceiveValue(null)
        } else {
            val picked = if (single) arrayOf(uris.first()) else uris.toTypedArray()
            callback?.onReceiveValue(picked)
        }
    }

    val vault by lazy { VaultStore(this) }
    private val actionExecutor by lazy { ActionExecutor(this, vault) }
    private val downloader by lazy { PicoDownloader(this) }

    private val capturePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val requests = pendingCaptureRequests.toList()
        pendingCaptureRequests.clear()
        requests.forEach { request ->
            val grantedResources = request.resources.filter { resource ->
                val permission = resourceToPermission(resource) ?: return@filter false
                grants[permission] == true ||
                    ContextCompat.checkSelfPermission(this, permission) ==
                    PackageManager.PERMISSION_GRANTED
            }
            if (grantedResources.isNotEmpty()) {
                request.grant(grantedResources.toTypedArray())
            } else {
                request.deny()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        setContentView(R.layout.activity_main)
        container = findViewById(R.id.container)
        splash = findViewById(R.id.splash)
        offline = findViewById(R.id.offline)
        errorIcon = offline.findViewById(R.id.error_icon)
        errorTitle = offline.findViewById(R.id.error_title)
        errorMessage = offline.findViewById(R.id.error_message)
        errorHint = offline.findViewById(R.id.error_hint)
        midBanner = findViewById(R.id.mid_session_banner)
        midBannerText = findViewById(R.id.mid_session_banner_text)
        retryButton = offline.findViewById(R.id.retry_button)
        retryButton.setOnClickListener { retryLoad() }
        offline.findViewById<Button>(R.id.open_browser_button).setOnClickListener { openExternal(lastUrl) }
        registerNetworkCallback()

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView = createWebView()
        container.addView(webView, 0)

        val startUrl = intent?.data?.toString()?.takeIf { isAllowedUrl(it) } ?: BuildConfig.WEB_URL
        webView.loadUrl(startUrl)
        applyDebugErrorOverride()

        // Resume the distraction shield if the user left it enabled — rules
        // persist in prefs but the service must be re-started on app launch.
        ShieldService.sync(this)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    confirmExit()
                }
            }
        })
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView = WebView(this).apply {
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            userAgentString = "$userAgentString PicoApp/${BuildConfig.VERSION_NAME}"
        }

        webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()
                return if (isAllowedUrl(url)) {
                    lastUrl = url
                    false
                } else {
                    openExternal(url)
                    true
                }
            }

            // Staging build: the page origin stays http://localhost:5173 but is served
            // from bundled APK assets, so vite / adb reverse :5173 are not needed.
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                if (!BuildConfig.BUNDLED_WEB) return null
                val url = request.url
                if (url.scheme != "http" || url.host != "localhost" || url.port != 5173) return null
                return serveBundledAsset(request)
            }

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                lastUrl = url
                mainFrameLoading = true
                mainFrameFailed = false
                hideErrorScreen()
                midBanner.visibility = View.GONE
                resetRetryState()
                scheduleLoadWatchdog()
            }

            override fun onPageFinished(view: WebView, url: String) {
                splash.visibility = View.GONE
                mainFrameLoading = false
                cancelLoadWatchdog()
                // WebView calls onPageFinished even for a failed main frame, so
                // only a clean finish counts as "the app is loaded".
                if (!mainFrameFailed) pageLoadedOnce = true
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError
            ) {
                if (!request.isForMainFrame) return
                mainFrameFailed = true
                mainFrameLoading = false
                cancelLoadWatchdog()
                resetRetryState()
                handleLoadFailure(LoadErrorClassifier.fromErrorCode(error.errorCode, isOnline()))
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: WebResourceResponse
            ) {
                if (!request.isForMainFrame) return
                val state = LoadErrorClassifier.fromHttpStatus(errorResponse.statusCode) ?: return
                mainFrameFailed = true
                mainFrameLoading = false
                cancelLoadWatchdog()
                resetRetryState()
                handleLoadFailure(state)
            }

            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                // Never proceed past a certificate problem — treat it as a server fault.
                handler.cancel()
                mainFrameFailed = true
                mainFrameLoading = false
                cancelLoadWatchdog()
                resetRetryState()
                handleLoadFailure(LoadErrorClassifier.fromSslError(isOnline()))
            }

            // Renderer crashed: drop the dead WebView and reload the last page in a fresh one.
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                container.removeView(view)
                view.destroy()
                webView = createWebView()
                container.addView(webView, 0)
                webView.loadUrl(lastUrl)
                return true
            }
        }
        webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                if (!isAllowedUrl(request.origin.toString())) {
                    request.deny()
                    return
                }
                val needed = request.resources
                    .mapNotNull(::resourceToPermission)
                    .distinct()
                if (needed.isEmpty()) {
                    request.deny()
                    return
                }
                val missing = needed.filter {
                    ContextCompat.checkSelfPermission(this@MainActivity, it) !=
                        PackageManager.PERMISSION_GRANTED
                }
                if (missing.isEmpty()) {
                    val grantable = request.resources.filter {
                        resourceToPermission(it) != null
                    }
                    request.grant(grantable.toTypedArray())
                } else {
                    pendingCaptureRequests.add(request)
                    capturePermissionLauncher.launch(missing.toTypedArray())
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                pendingCaptureRequests.remove(request)
            }

            override fun onShowFileChooser(
                view: WebView,
                filePathCallback: android.webkit.ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                this@MainActivity.pendingFileChooserSingle =
                    params.mode != WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE
                val accepted = params.acceptTypes.filter { it.contains('/') }
                val mimes = if (accepted.isEmpty()) arrayOf("*/*") else accepted.toTypedArray()
                return try {
                    fileChooserLauncher.launch(mimes)
                    true
                } catch (e: android.content.ActivityNotFoundException) {
                    this@MainActivity.filePathCallback = null
                    filePathCallback.onReceiveValue(null)
                    false
                }
            }
        }
        val token = UUID.randomUUID().toString()
        bridgeToken = if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) token else null
        bridgeToken?.let { WebViewCompat.addDocumentStartJavaScript(this, bridgeScript(it), bridgeOrigins()) }
        addJavascriptInterface(PicoBridge(this@MainActivity), "PicoBridge")
        addJavascriptInterface(downloader, "PicoDownload")
        setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            downloader.onDownloadStart(url, userAgent, contentDisposition, mimeType)
        }
    }

    // Runs before page scripts, only in frames whose origin is in bridgeOrigins(). It swaps the raw
    // injected object for a frozen wrapper that adds the token to every call. Page code never sees
    // the raw object or the token; other frames never run this script and have no token.
    private fun bridgeScript(token: String): String {
        val methods = listOf(
            "share", "openExternal", "logMessage", "logError", "openAppSettings",
            "hasCapability", "requestAccess", "performAction", "vaultSet", "vaultHas", "setShield",
            "setSystemBars",
            "focusStatus", "focusSetEnabled", "focusSetupPasscode", "focusStart", "focusBeginWait",
            "focusEarlyUnblock", "focusEmergency", "focusRecover", "focusRequestAccountReset", "listLaunchableApps",
        )
        val wrappers = methods.joinToString("\n") { m ->
            "  api.$m = function () { var a = [TOKEN]; for (var i = 0; i < arguments.length; i++) a.push(arguments[i]); return raw.$m.apply(raw, a); };"
        }
        return """
(function () {
  var raw = window.PicoBridge;
  if (!raw) return;
  var TOKEN = "$token";
  var api = { getAppVersion: function () { return raw.getAppVersion(); } };
$wrappers
  Object.defineProperty(window, 'PicoBridge', { value: Object.freeze(api), writable: false, configurable: false });
})();
""".trimIndent()
    }

    private fun bridgeOrigins(): Set<String> = buildSet {
        add("https://${BuildConfig.ALLOWED_HOST_SUFFIX}")
        add("https://*.${BuildConfig.ALLOWED_HOST_SUFFIX}")
        if (BuildConfig.DEBUG) add("http://localhost:5173")
    }

    fun requestPermission(permission: String, onResult: (Boolean) -> Unit) {
        if (ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED) {
            onResult(true)
            return
        }
        // Only one request can be in flight: an older caller gets a denial instead of waiting forever.
        pendingPermissionResult?.invoke(false)
        pendingPermissionResult = onResult
        permissionLauncher.launch(permission)
    }

    fun requestAccess(feature: String) {
        runOnUiThread {
            val permission = Capabilities.runtimePermission(feature)
            when {
                permission != null -> {
                    // Android stops showing the system dialog after a denial with "Don't ask again"
                    // and returns no result. Report that as permanent so the web shows the settings screen.
                    val asked = getSharedPreferences("pico_permissions", MODE_PRIVATE)
                        .getBoolean("asked_" + permission, false)
                    if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED &&
                        asked && !shouldShowRequestPermissionRationale(permission)
                    ) {
                        emitCapability(feature, false, true)
                    } else {
                        getSharedPreferences("pico_permissions", MODE_PRIVATE).edit()
                            .putBoolean("asked_" + permission, true).apply()
                        requestPermission(permission) { granted ->
                            val permanent = !granted && !shouldShowRequestPermissionRationale(permission)
                            emitCapability(feature, granted, permanent)
                        }
                    }
                }
                feature == "overlay" -> startActivity(
                    Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                )
                feature == "usage" -> startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
            }
        }
    }

    fun runAgentAction(id: String, action: String, argsJson: String) {
        runOnUiThread {
            val args = try {
                JSONObject(argsJson)
            } catch (_: Exception) {
                null
            }
            if (args == null) {
                emitActionResult(id, "invalid")
                return@runOnUiThread
            }
            actionExecutor.run(action, args) { status -> emitActionResult(id, status) }
        }
    }

    fun isTrustedPage(): Boolean = isAllowedUrl(lastUrl)

    fun isBridgeCall(token: String?): Boolean = token != null && token == bridgeToken && isTrustedPage()

    // Runtime permission result for window.PicoCapability.onResult(feature, granted, permanentlyDenied).
    private fun emitCapability(feature: String, granted: Boolean, permanent: Boolean) {
        webView.evaluateJavascript(
            "window.PicoCapability&&window.PicoCapability.onResult&&window.PicoCapability.onResult(${JSONObject.quote(feature)},$granted,$permanent)",
            null
        )
    }

    private fun emitActionResult(id: String, status: String) {
        webView.evaluateJavascript(
            "window.PicoAction&&window.PicoAction.onResult&&window.PicoAction.onResult(${JSONObject.quote(id)},${JSONObject.quote(status)})",
            null
        )
    }

    private fun resourceToPermission(resource: String): String? = when (resource) {
        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
        else -> null
    }

    // Maps a request on the bundled origin to app assets (src/staging/assets/web).
    // Unknown main-frame paths fall back to index.html (SPA: /auth, ?chat= deep links).
    private fun serveBundledAsset(request: WebResourceRequest): WebResourceResponse? {
        if (request.method != "GET") return null
        val raw = request.url.path?.trimStart('/')?.ifEmpty { "index.html" } ?: return null
        if (raw.contains("..")) return null
        var name = raw
        var stream = openAsset("web/$name")
        if (stream == null && request.isForMainFrame) {
            name = "index.html"
            stream = openAsset("web/index.html")
        }
        val s = stream ?: return null
        val mime = bundledMime(name)
        if (mime == null) {
            s.close()
            return null
        }
        val encoding = if (mime.startsWith("text/") || mime == "application/json" ||
            mime == "image/svg+xml" || mime == "application/manifest+json"
        ) "UTF-8" else null
        return WebResourceResponse(mime, encoding, s)
    }

    private fun openAsset(path: String) = try {
        assets.open(path)
    } catch (_: Exception) {
        null
    }

    private fun bundledMime(name: String): String? {
        val ext = name.substringAfterLast('.', "").lowercase()
        return when (ext) {
            "html", "htm" -> "text/html"
            "js", "mjs" -> "text/javascript"
            "css" -> "text/css"
            "json" -> "application/json"
            "wasm" -> "application/wasm"
            "svg" -> "image/svg+xml"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "webp" -> "image/webp"
            "gif" -> "image/gif"
            "ico" -> "image/x-icon"
            "woff" -> "font/woff"
            "woff2" -> "font/woff2"
            "ttf" -> "font/ttf"
            "otf" -> "font/otf"
            "mp3" -> "audio/mpeg"
            "wav" -> "audio/wav"
            "mp4" -> "video/mp4"
            "webm" -> "video/webm"
            "txt" -> "text/plain"
            else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
                ?: if (name.endsWith("index.html")) "text/html" else null
        }
    }

    private fun isAllowedUrl(url: String): Boolean {
        val uri = Uri.parse(url) ?: return false
        val host = uri.host ?: return false
        val scheme = uri.scheme ?: return false
        // Plain http and localhost exist only for the debug build (Vite dev server / emulator).
        if (scheme != "https" && !(BuildConfig.DEBUG && scheme == "http")) return false
        if (BuildConfig.DEBUG && (host == "localhost" || host == "10.0.2.2")) return true
        return host == BuildConfig.ALLOWED_HOST_SUFFIX ||
            host.endsWith(".${BuildConfig.ALLOWED_HOST_SUFFIX}")
    }

    private fun openExternal(url: String) {
        val scheme = Uri.parse(url).scheme
        if (scheme != "https" && scheme != "http") return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
            // No handler available — ignore.
        }
    }

    // ── Load failure handling ──────────────────────────────────────────
    // Two surfaces: the full-screen error (initial load, or whenever it is
    // already up) and the small amber mid-session banner (page was loaded,
    // then a main-frame request failed — the rendered page stays visible).

    private fun handleLoadFailure(state: LoadErrorState) {
        if (forcedError) return // a debug-forced screen wins over real callbacks
        if (pageLoadedOnce && !errorScreenActive) {
            showMidBanner(state)
        } else {
            showErrorScreen(state)
        }
    }

    private fun showErrorScreen(state: LoadErrorState) {
        errorScreenActive = true
        retryGate.resetAutoRetry() // each fresh screen earns one auto-retry
        splash.visibility = View.GONE
        midBanner.visibility = View.GONE
        val icon: Int
        val iconCd: Int
        val title: Int
        val message: Int
        when (state) {
            LoadErrorState.OFFLINE -> {
                icon = R.drawable.ic_error_offline
                iconCd = R.string.cd_error_offline
                title = R.string.error_offline_title
                message = R.string.error_offline_message
            }
            LoadErrorState.SERVER_UNREACHABLE -> {
                icon = R.drawable.ic_error_unreachable
                iconCd = R.string.cd_error_server
                title = R.string.error_unreachable_title
                message = R.string.error_unreachable_message
            }
            LoadErrorState.SERVER_ERROR -> {
                icon = R.drawable.ic_error_server
                iconCd = R.string.cd_error_server
                title = R.string.error_server_title
                message = R.string.error_server_message
            }
            LoadErrorState.TIMEOUT -> {
                icon = R.drawable.ic_error_timeout
                iconCd = R.string.cd_error_timeout
                title = R.string.error_timeout_title
                message = R.string.error_timeout_message
            }
        }
        errorIcon.setImageResource(icon)
        errorIcon.contentDescription = getString(iconCd)
        errorTitle.setText(title)
        errorMessage.setText(message)
        errorHint.visibility = View.GONE
        // "Open in browser" only helps when the URL is a real web address.
        val urlScheme = Uri.parse(lastUrl).scheme
        offline.findViewById<Button>(R.id.open_browser_button).visibility =
            if (urlScheme == "https" || urlScheme == "http") View.VISIBLE else View.GONE
        offline.visibility = View.VISIBLE
    }

    private fun hideErrorScreen() {
        errorScreenActive = false
        forcedError = false
        if (::offline.isInitialized) offline.visibility = View.GONE
    }

    private fun showMidBanner(state: LoadErrorState) {
        splash.visibility = View.GONE
        midBannerText.setText(
            if (state == LoadErrorState.OFFLINE) R.string.banner_offline else R.string.banner_server
        )
        midBanner.visibility = View.VISIBLE
    }

    // Watchdog: a main frame still loading after the limit is reported as
    // TIMEOUT (or OFFLINE when connectivity dropped in between). Fires on the
    // WebView's own handler, so posting to it ties the check to the UI thread.
    private fun scheduleLoadWatchdog() {
        cancelLoadWatchdog()
        val watchdog = Runnable {
            if (mainFrameLoading) {
                mainFrameFailed = true
                mainFrameLoading = false
                webView.stopLoading()
                resetRetryState()
                handleLoadFailure(LoadErrorClassifier.fromWatchdogTimeout(isOnline()))
            }
        }
        loadWatchdog = watchdog
        webView.postDelayed(watchdog, LOAD_WATCHDOG_MS)
    }

    private fun cancelLoadWatchdog() {
        loadWatchdog?.let { webView.removeCallbacks(it) }
        loadWatchdog = null
    }

    // Auto-retry: when the network becomes validated again while the error
    // screen is up, retry once without making the user tap.
    private fun registerNetworkCallback() {
        val manager = getSystemService(ConnectivityManager::class.java) ?: return
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) return
                runOnUiThread {
                    if (errorScreenActive && retryGate.beginAutoRetry()) retryLoad()
                }
            }
        }
        manager.registerDefaultNetworkCallback(callback)
        networkCallback = callback
    }

    // Dev hook: `adb shell am start -n com.askpico.pico/.MainActivity
    //   --es pico_force_error offline|server|http500|timeout` (debug builds)
    // forces the matching error screen without breaking the real network path.
    private fun applyDebugErrorOverride() {
        if (!BuildConfig.DEBUG) return
        val forced = intent?.getStringExtra(EXTRA_FORCE_ERROR) ?: return
        val state = when (forced) {
            "offline" -> LoadErrorState.OFFLINE
            "server", "unreachable" -> LoadErrorState.SERVER_UNREACHABLE
            "http500", "server_error" -> LoadErrorState.SERVER_ERROR
            "timeout" -> LoadErrorState.TIMEOUT
            else -> return
        }
        webView.postDelayed({
            forcedError = true
            showErrorScreen(state)
        }, 1200)
    }

    private fun isOnline(): Boolean {
        val manager = getSystemService(ConnectivityManager::class.java) ?: return false
        val network = manager.activeNetwork ?: return false
        val caps = manager.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    // Retry first checks real connectivity instead of blindly reloading (a blind reload
    // while still offline just errors again) — a still-offline tap shows the inline
    // hint instead of a toast. The button is disabled while a retry is in flight so
    // taps cannot stack, and the main document is fetched with no-cache so a stale
    // cached shell cannot come back. The login session lives in WebView storage
    // (localStorage), which a page reload never touches.
    private fun retryLoad() {
        if (!isOnline()) {
            errorHint.setText(R.string.error_still_offline)
            errorHint.visibility = View.VISIBLE
            return
        }
        if (!retryGate.beginRetry()) return
        errorHint.visibility = View.GONE
        retryButton.isEnabled = false
        retryButton.text = getString(R.string.error_retrying)
        webView.loadUrl(lastUrl, mapOf("Cache-Control" to "no-cache"))
    }

    private fun resetRetryState() {
        retryGate.finish()
        if (::retryButton.isInitialized) {
            retryButton.isEnabled = true
            retryButton.text = getString(R.string.error_retry)
        }
    }

    private fun confirmExit() {
        AlertDialog.Builder(this)
            .setTitle(R.string.app_name)
            .setMessage("Exit Pico?")
            .setPositiveButton("Exit") { _, _ -> finish() }
            .setNegativeButton("Stay", null)
            .show()
    }

    // Low memory: tell the shield to drop its overlay and the web app to pause
    // heavy surfaces (artifact preview). Chat is untouched. The flag
    // latches until the process restarts — there is no "memory ok again" signal.
    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level < ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) return
        ShieldService.setMemoryPressure(true)
        webView.evaluateJavascript(
            "window.PicoMemory&&window.PicoMemory.onLowMemory&&window.PicoMemory.onLowMemory($level)",
            null
        )
    }

    // fontScale is handled in place (no recreate), so WebView must follow the system text size itself.
    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        webView.settings.textZoom = (newConfig.fontScale * 100).toInt().coerceIn(50, 300)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        networkCallback?.let {
            try {
                getSystemService(ConnectivityManager::class.java)?.unregisterNetworkCallback(it)
            } catch (_: Exception) {
            }
        }
        networkCallback = null
        webView.destroy()
        super.onDestroy()
    }
}
