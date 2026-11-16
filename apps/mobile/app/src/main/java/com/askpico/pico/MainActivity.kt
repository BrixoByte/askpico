package com.askpico.pico

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.view.View
import android.view.ViewGroup
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
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
import com.askpico.pico.agent.VaultStore
import org.json.JSONObject
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.UUID

class MainActivity : AppCompatActivity() {

    internal lateinit var webView: WebView
    private lateinit var container: ViewGroup
    private lateinit var splash: View
    private lateinit var offline: View
    @Volatile private var lastUrl: String = BuildConfig.WEB_URL
    // Token that Pico-origin frames get through the document-start script. Null = bridge refuses everything.
    @Volatile private var bridgeToken: String? = null
    private val pendingCaptureRequests = mutableListOf<PermissionRequest>()

    // Voice input (SpeechRecognizer bridge for window.PicoBridge).
    private var speechRecognizer: SpeechRecognizer? = null
    private var pendingVoiceLang: String? = null
    private var voiceWanted = false
    private var voiceRetries = 0
    private var idleRestarts = 0
    private var voiceLang = "en-US"
    // Offline recognition needs a language pack; turned off for the rest of the app run after a language error.
    private var preferOffline = true

    // Native reply speech (Android TextToSpeech). WebView often has no window.speechSynthesis.
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val ttsProgress = object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {}
        override fun onDone(utteranceId: String?) = emitTts(utteranceId)
        // stop() and QUEUE_FLUSH end an utterance through onStop, not onDone. Without this the web never hears about it.
        override fun onStop(utteranceId: String?, interrupted: Boolean) = emitTts(utteranceId)
        override fun onError(utteranceId: String?) {
            android.util.Log.e("PICO_TTS", "utterance error id=$utteranceId")
            emitTts(utteranceId)
        }
    }

    private val voicePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val lang = pendingVoiceLang
        pendingVoiceLang = null
        if (granted && lang != null) beginVoiceSession(lang)
        else if (lang != null) {
            emitVoice("onError", SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS.toString())
            emitVoice("onEnd")
        }
    }

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
        offline.findViewById<Button>(R.id.retry_button).setOnClickListener { webView.loadUrl(lastUrl) }
        offline.findViewById<Button>(R.id.open_browser_button).setOnClickListener { openExternal(lastUrl) }

        tts = TextToSpeech(this) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            tts?.setOnUtteranceProgressListener(ttsProgress)
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView = createWebView()
        container.addView(webView, 0)

        val startUrl = intent?.data?.toString()?.takeIf { isAllowedUrl(it) } ?: BuildConfig.WEB_URL
        webView.loadUrl(startUrl)

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
                offline.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView, url: String) {
                splash.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError
            ) {
                if (request.isForMainFrame) showOffline()
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
            "share", "openExternal", "speak", "stopSpeaking", "logMessage", "logError", "openAppSettings",
            "hasCapability", "requestAccess", "performAction", "vaultSet", "vaultHas", "setShield",
            "setSystemBars", "startVoiceInput", "stopVoiceInput",
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

    // ── Voice input bridge (window.PicoBridge.startVoiceInput) ────────────
    // Events are posted to window.PicoVoice.{onPartial,onResult,onError,onEnd,onSpeechStart}.

    fun startVoiceInput(language: String) {
        runOnUiThread {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                pendingVoiceLang = language
                voicePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                return@runOnUiThread
            }
            beginVoiceSession(language)
        }
    }

    fun stopVoiceInput() {
        runOnUiThread {
            if (voiceWanted) endVoiceSession() else speechRecognizer?.cancel()
        }
    }

    // The session listens continuously until the result, a fatal error, or JS calls stopVoiceInput.
    // Silence and recognizer timeouts restart the recognizer here, so the mic never goes idle by itself.
    private fun beginVoiceSession(language: String) {
        voiceLang = language
        voiceWanted = true
        voiceRetries = 0
        idleRestarts = 0
        startListening(language)
    }

    private fun restartListening(delayMs: Long = 300) {
        webView.postDelayed({ if (voiceWanted) startListening(voiceLang) }, delayMs)
    }

    private fun endVoiceSession() {
        voiceWanted = false
        try {
            speechRecognizer?.cancel()
        } catch (_: Exception) {
        }
        emitVoice("onEnd")
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

    // Reply speech. Completion is reported to window.PicoTTS.onDone(id) so the web queue can continue.
    fun speakNative(id: String, text: String, lang: String) {
        runOnUiThread {
            val engine = tts
            if (engine == null || !ttsReady) {
                emitTts(id)
                return@runOnUiThread
            }
            val locale = Locale.forLanguageTag(lang)
            val available = engine.isLanguageAvailable(locale)
            android.util.Log.d("PICO_TTS", "speak lang=$lang availability=$available chars=${text.length}")
            if (available >= TextToSpeech.LANG_AVAILABLE) engine.language = locale
            else android.util.Log.w("PICO_TTS", "no TTS voice installed for $lang; install it in Settings > Text-to-speech")
            val result = engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
            if (result != TextToSpeech.SUCCESS) {
                android.util.Log.e("PICO_TTS", "speak() returned $result")
                emitTts(id)
            }
        }
    }

    fun stopNativeSpeech() {
        runOnUiThread { tts?.stop() }
    }

    private fun emitTts(id: String?) {
        runOnUiThread {
            webView.evaluateJavascript(
                "window.PicoTTS&&window.PicoTTS.onDone&&window.PicoTTS.onDone(${JSONObject.quote(id ?: "")})",
                null
            )
        }
    }

    private fun startListening(language: String) {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            emitVoice("onError", "-1")
            endVoiceSession()
            return
        }
        if (speechRecognizer == null) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).also { rec ->
                rec.setRecognitionListener(voiceListener)
            }
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, preferOffline)
        }
        try {
            speechRecognizer?.startListening(intent)
        } catch (_: Exception) {
            emitVoice("onError", "-1")
            endVoiceSession()
        }
    }

    private val voiceListener = object : RecognitionListener {
        private val MAX_TRANSIENT_RETRIES = 3
        private val MAX_IDLE_RESTARTS = 3
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {
            voiceRetries = 0
            idleRestarts = 0
            emitVoice("onSpeechStart")
        }
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onError(error: Int) {
            if (!voiceWanted) return
            when (error) {
                SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> {
                    // Bounded idle restart: silence must not loop the recognizer forever.
                    if (idleRestarts < MAX_IDLE_RESTARTS) {
                        idleRestarts++
                        restartListening(400L * idleRestarts)
                    } else {
                        idleRestarts = 0
                        emitVoice("onError", SpeechRecognizer.ERROR_NO_MATCH.toString())
                        endVoiceSession()
                    }
                }
                // 12 = ERROR_LANGUAGE_NOT_SUPPORTED, 13 = ERROR_LANGUAGE_UNAVAILABLE (API 31+; literals keep minSdk 24).
                12, 13 -> if (preferOffline) {
                    preferOffline = false
                    android.util.Log.w("PICO_VOICE", "offline language pack missing (error $error); retrying with online recognition")
                    restartListening()
                } else fail(error)
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY,
                SpeechRecognizer.ERROR_NETWORK,
                SpeechRecognizer.ERROR_NETWORK_TIMEOUT,
                SpeechRecognizer.ERROR_SERVER,
                SpeechRecognizer.ERROR_SERVER_DISCONNECTED,
                SpeechRecognizer.ERROR_TOO_MANY_REQUESTS,
                SpeechRecognizer.ERROR_CLIENT -> {
                    if (voiceRetries++ < MAX_TRANSIENT_RETRIES) restartListening(1000)
                    else fail(error)
                }
                else -> fail(error)
            }
        }
        override fun onResults(results: Bundle?) {
            if (!voiceWanted) return
            val text = results
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()?.trim().orEmpty()
            if (text.isEmpty()) {
                if (idleRestarts < MAX_IDLE_RESTARTS) {
                    idleRestarts++
                    restartListening(400L * idleRestarts)
                } else {
                    idleRestarts = 0
                    emitVoice("onError", SpeechRecognizer.ERROR_NO_MATCH.toString())
                    endVoiceSession()
                }
                return
            }
            voiceRetries = 0
            idleRestarts = 0
            voiceWanted = false
            emitVoice("onResult", JSONObject.quote(text))
            emitVoice("onEnd")
        }
        override fun onPartialResults(partialResults: Bundle?) {
            if (!voiceWanted) return
            val text = partialResults
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()?.trim().orEmpty()
            if (text.isNotEmpty()) {
                idleRestarts = 0
                emitVoice("onPartial", JSONObject.quote(text))
            }
        }
        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    private fun fail(error: Int) {
        emitVoice("onError", error.toString())
        endVoiceSession()
    }

    private fun emitVoice(event: String, payload: String? = null) {
        val call = if (payload == null) "PicoVoice.$event()" else "PicoVoice.$event($payload)"
        webView.evaluateJavascript("window.PicoVoice&&window.PicoVoice.$event&&$call", null)
    }

    private fun resourceToPermission(resource: String): String? = when (resource) {
        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
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

    private fun showOffline() {
        splash.visibility = View.GONE
        offline.visibility = View.VISIBLE
    }

    private fun confirmExit() {
        AlertDialog.Builder(this)
            .setTitle(R.string.app_name)
            .setMessage("Exit Pico?")
            .setPositiveButton("Exit") { _, _ -> finish() }
            .setNegativeButton("Stay", null)
            .show()
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
        try {
            tts?.shutdown()
        } catch (_: Exception) {
        }
        try {
            speechRecognizer?.destroy()
        } catch (_: Exception) {
        }
        speechRecognizer = null
        webView.destroy()
        super.onDestroy()
    }
}
