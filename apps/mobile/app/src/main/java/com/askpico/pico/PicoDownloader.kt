package com.askpico.pico

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.widget.Toast
import androidx.core.app.NotificationCompat
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

/**
 * Handles WebView downloads. http(s) URLs go through DownloadManager; blob:/data:
 * URLs are pulled into JS, streamed back base64-chunked through [writeChunk], and
 * saved via MediaStore.Downloads (API 29+) or the public Downloads dir (API <= 28).
 */
class PicoDownloader(private val activity: MainActivity) {

    companion object {
        private const val MAX_BYTES = 50L * 1024 * 1024
        private const val NAME_MAX = 120
        private const val CHANNEL_ID = "pico_downloads"
    }

    // ── JS interface state (calls arrive on the JavaBridge thread) ──────
    // One active blob download at a time: a second startDownload with a different
    // token is rejected so concurrent downloads cannot interleave chunks.
    @Volatile private var activeToken: String? = null
    @Volatile private var pendingName: String? = null
    @Volatile private var pendingMime: String = "application/octet-stream"
    @Volatile private var buffer = ByteArrayOutputStream()
    @Volatile private var totalBytes = 0L
    @Volatile private var failed = false

    @JavascriptInterface
    fun startDownload(origin: String, token: String, rawName: String, mimeType: String, declaredBytes: Long): Boolean {
        if (!isAllowedOrigin(origin)) return false
        if (pendingName != null) {
            activity.runOnUiThread {
                Toast.makeText(activity, "A download is already in progress", Toast.LENGTH_SHORT).show()
            }
            return false
        }
        activeToken = token
        val name = sanitizeName(rawName.ifBlank { "download" })
        pendingName = name
        pendingMime = mimeType.ifBlank { "application/octet-stream" }
        buffer = ByteArrayOutputStream()
        totalBytes = 0L
        failed = false
        return true
    }

    @JavascriptInterface
    fun writeChunk(token: String, base64: String): Boolean {
        if (failed || pendingName == null || activeToken != token) return false
        val bytes = try {
            Base64.decode(base64, Base64.DEFAULT)
        } catch (_: Exception) {
            failed = true
            return false
        }
        totalBytes += bytes.size
        if (totalBytes > MAX_BYTES) {
            failed = true
            buffer.reset()
            return false
        }
        buffer.write(bytes)
        return true
    }

    @JavascriptInterface
    fun finishDownload(token: String): Boolean {
        val name = pendingName ?: return false
        if (activeToken != token) return false
        if (failed) {
            pendingName = null
            activeToken = null
            activity.runOnUiThread {
                Toast.makeText(activity, "Download failed: file too large or invalid", Toast.LENGTH_LONG).show()
            }
            return false
        }
        val data = buffer.toByteArray()
        val mime = pendingMime
        pendingName = null
        activeToken = null
        buffer.reset()
        totalBytes = 0L
        saveBytes(name, mime, data)
        return true
    }

    @JavascriptInterface
    fun cancelDownload(token: String) {
        if (activeToken == token) {
            pendingName = null
            activeToken = null
            buffer.reset()
            totalBytes = 0L
            failed = false
        }
    }

    // Called directly from the page (window.PicoDownload.saveBlobUrl) so the real
    // filename/mime survive — DownloadListener cannot see the <a download> attribute.
    @JavascriptInterface
    fun saveBlobUrl(origin: String, blobUrl: String, rawName: String, mimeType: String): Boolean {
        if (!isAllowedOrigin(origin)) return false
        if (!blobUrl.startsWith("blob:")) return false
        val js = blobFetchScript(blobUrl, sanitizeName(rawName.ifBlank { "download" }), mimeType.ifBlank { "application/octet-stream" })
        // JS-interface calls arrive on the JavaBridge thread; WebView APIs need main.
        activity.runOnUiThread { activity.webView.evaluateJavascript(js, null) }
        return true
    }

    // ── DownloadListener entry point ────────────────────────────────────

    fun onDownloadStart(url: String, userAgent: String?, contentDisposition: String?, mimeType: String?) {
        when {
            url.startsWith("http://") || url.startsWith("https://") -> downloadHttp(url, userAgent, contentDisposition, mimeType)
            url.startsWith("blob:") -> downloadBlob(url, mimeType)
            url.startsWith("data:") -> downloadDataUrl(url)
            else -> toast("Unsupported download: $url")
        }
    }

    private fun downloadHttp(url: String, userAgent: String?, contentDisposition: String?, mimeType: String?) {
        val name = URLUtil.guessFileName(url, contentDisposition, mimeType)
        Thread {
            try {
                val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                conn.connectTimeout = 15_000
                conn.readTimeout = 30_000
                conn.instanceFollowRedirects = true
                userAgent?.let { conn.setRequestProperty("User-Agent", it) }
                CookieManager.getInstance().getCookie(url)?.let {
                    conn.setRequestProperty("Cookie", it)
                }
                val code = conn.responseCode
                if (code !in 200..299) throw IllegalStateException("HTTP $code")
                val out = ByteArrayOutputStream()
                conn.inputStream.use { input ->
                    val buf = ByteArray(64 * 1024)
                    var total = 0L
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        total += n
                        if (total > MAX_BYTES) throw IllegalStateException("file too large")
                        out.write(buf, 0, n)
                    }
                }
                conn.disconnect()
                val mime = conn.contentType?.substringBefore(';')
                    ?: mimeType ?: "application/octet-stream"
                saveBytes(name, mime, out.toByteArray())
            } catch (e: Exception) {
                toast("Download failed: ${e.message}")
            }
        }.start()
    }

    // blob:/data: cannot be fetched by DownloadManager — pull the bytes in JS.
    private fun downloadBlob(blobUrl: String, mimeType: String?) {
        val name = runCatching {
            URLUtil.guessFileName(blobUrl, null, mimeType)
        }.getOrDefault("download")
        val js = blobFetchScript(blobUrl, name, mimeType ?: "")
        activity.webView.evaluateJavascript(js, null)
    }

    private fun downloadDataUrl(dataUrl: String) {
        try {
            val comma = dataUrl.indexOf(',')
            if (comma < 0) { toast("Download failed: bad data URL"); return }
            val meta = dataUrl.substring(5, comma)
            val mime = meta.substringBefore(';').ifBlank { "application/octet-stream" }
            val isBase64 = meta.substringAfter(';', "").contains("base64")
            val payload = dataUrl.substring(comma + 1)
            val bytes = if (isBase64) {
                Base64.decode(payload, Base64.DEFAULT)
            } else {
                java.net.URLDecoder.decode(payload, "UTF-8").toByteArray(Charsets.UTF_8)
            }
            if (bytes.size > MAX_BYTES) { toast("Download failed: file too large"); return }
            saveBytes(sanitizeName("download"), mime, bytes)
        } catch (e: Exception) {
            toast("Download failed: ${e.message}")
        }
    }

    private fun blobFetchScript(blobUrl: String, name: String, mimeHint: String): String {
        val jsUrl = org.json.JSONObject.quote(blobUrl)
        val jsName = org.json.JSONObject.quote(name)
        val jsMime = org.json.JSONObject.quote(mimeHint)
        return """
(function(){
  try {
    fetch($jsUrl).then(function(r){ if(!r.ok) throw new Error('fetch '+r.status); return r.blob(); })
    .then(function(b){
      var fr = new FileReader();
      fr.onload = function(){
        try {
          var du = String(fr.result);
          var comma = du.indexOf(',');
          var meta = du.slice(5, comma);
          var mime = (meta.split(';')[0] || $jsMime || 'application/octet-stream');
          var b64 = du.slice(comma + 1);
          var sid = 'd' + Math.random().toString(36).slice(2) + Date.now();
          if (!window.PicoDownload || !PicoDownload.startDownload(location.origin, sid, $jsName, mime, b64.length)) {
            console.error('PicoDownload rejected'); return;
          }
          for (var i = 0; i < b64.length; i += 262144) {
            if (!PicoDownload.writeChunk(sid, b64.slice(i, i + 262144))) { PicoDownload.cancelDownload(sid); return; }
          }
          PicoDownload.finishDownload(sid);
        } catch (e) { try { PicoDownload.cancelDownload(typeof sid !== 'undefined' ? sid : ''); } catch(_){} console.error(e); }
      };
      fr.readAsDataURL(b);
    }).catch(function(e){ console.error('PicoDownload fetch failed', e); });
  } catch (e) { console.error(e); }
})();
""".trimIndent()
    }

    // ── Saving ──────────────────────────────────────────────────────────

    private fun saveBytes(rawName: String, mime: String, bytes: ByteArray) {
        val name = sanitizeName(rawName)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveMediaStore(name, mime, bytes)
        } else {
            saveLegacy(name, mime, bytes)
        }
    }

    private fun saveMediaStore(name: String, mime: String, bytes: ByteArray) {
        try {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = activity.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("MediaStore insert failed")
            resolver.openOutputStream(uri)?.use { it.write(bytes) }
                ?: throw IllegalStateException("Cannot open download file")
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            notifySaved(uri, name)
            toast("Saved to Downloads: $name")
        } catch (e: Exception) {
            toast("Download failed: ${e.message}")
        }
    }

    private fun saveLegacy(name: String, mime: String, bytes: ByteArray) {
        try {
            val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!dir.exists()) dir.mkdirs()
            val file = File(dir, name)
            FileOutputStream(file).use { it.write(bytes) }
            toast("Saved to Downloads: $name")
        } catch (e: Exception) {
            // No storage permission on old APIs — fall back to app-specific dir.
            try {
                val dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                    ?: activity.filesDir
                val file = File(dir, name)
                FileOutputStream(file).use { it.write(bytes) }
                toast("Saved (app storage): $name")
            } catch (e2: Exception) {
                toast("Download failed: ${e2.message}")
            }
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private fun sanitizeName(raw: String): String {
        var name = raw.substringAfterLast('/').substringAfterLast('\\')
        name = name.replace(Regex("[\\x00-\\x1f]"), "").replace("..", "")
        if (name.isBlank() || name == "." ) name = "download"
        if (name.length > NAME_MAX) {
            val dot = name.lastIndexOf('.')
            name = if (dot > 0) name.take(dot).take(NAME_MAX - 12) + name.substring(dot) else name.take(NAME_MAX)
        }
        return name
    }

    private fun isAllowedOrigin(origin: String): Boolean {
        val uri = Uri.parse(origin) ?: return false
        val scheme = uri.scheme ?: return false
        val host = uri.host ?: return false
        if (scheme != "https" && !(BuildConfig.DEBUG && scheme == "http")) return false
        if (BuildConfig.DEBUG && (host == "localhost" || host == "10.0.2.2")) return true
        return host == BuildConfig.ALLOWED_HOST_SUFFIX ||
            host.endsWith(".${BuildConfig.ALLOWED_HOST_SUFFIX}")
    }

    // Tap action opens the saved file through its MediaStore content URI.
    private fun notifySaved(uri: Uri, name: String) {
        try {
            val nm = activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                nm.getNotificationChannel(CHANNEL_ID) == null) {
                nm.createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, "Downloads", NotificationManager.IMPORTANCE_DEFAULT)
                )
            }
            val view = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val pi = PendingIntent.getActivity(
                activity, uri.hashCode(), view,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val n = NotificationCompat.Builder(activity, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("Download complete")
                .setContentText(name)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build()
            nm.notify((System.currentTimeMillis() % 100000).toInt(), n)
        } catch (_: Exception) {
        }
    }

    private fun toast(msg: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, msg, Toast.LENGTH_LONG).show()
        }
    }
}
