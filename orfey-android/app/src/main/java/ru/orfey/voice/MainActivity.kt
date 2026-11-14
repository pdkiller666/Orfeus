package ru.orfey.voice

import android.app.AlertDialog
import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.ValueCallback
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import java.io.ByteArrayInputStream

class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private var samplesBridge: GitHubSamplesBridge? = null
    private var pendingMicRequest: PermissionRequest? = null
    private var pendingFileChooser: ValueCallback<Array<Uri>>? = null

    private val micLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val request = pendingMicRequest
        pendingMicRequest = null
        if (request != null) {
            try {
                if (granted && !isFinishing && !isDestroyed) {
                    request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                } else {
                    request.deny()
                }
            } catch (_: IllegalStateException) {
                // The WebView renderer may have cancelled the request while Android showed the prompt.
            }
        }
    }

    private val audioFilePicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        val callback = pendingFileChooser
        pendingFileChooser = null
        callback?.onReceiveValue(uri?.let { arrayOf(it) })
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this)
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            allowUniversalAccessFromFileURLs = false
            allowFileAccessFromFileURLs = false
        }
        web.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val uri = request.url
                if (isAssetUrl(uri)) return loader.shouldInterceptRequest(uri)
                if (request.method == "GET" && isAllowedRemoteReadUrl(uri)) return null
                return WebResourceResponse(
                    "text/plain",
                    "utf-8",
                    ByteArrayInputStream(ByteArray(0))
                )
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (isAssetUrl(uri)) return false
                if (uri.scheme != "https") return true
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (_: ActivityNotFoundException) {
                    true
                }
            }
        }
        samplesBridge = GitHubSamplesBridge(this, web)
        web.addJavascriptInterface(samplesBridge!!, "OrfeyGitHub")
        web.webChromeClient = object : WebChromeClient() {
            override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                if (!isAssetUrl(Uri.parse(url))) {
                    result.cancel()
                    return true
                }
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("Подтверждение публикации")
                    .setMessage(message)
                    .setPositiveButton("Продолжить") { _, _ -> result.confirm() }
                    .setNegativeButton("Отмена") { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }

            override fun onShowFileChooser(
                view: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: WebChromeClient.FileChooserParams
            ): Boolean {
                val acceptsAudio = fileChooserParams.acceptTypes.orEmpty().any { type ->
                    val normalized = type.substringBefore(';').trim().lowercase()
                    normalized == "*/*" || normalized == "audio/*" || normalized.startsWith("audio/")
                }
                if (!isAssetUrl(Uri.parse(view.url ?: "")) || !acceptsAudio) {
                    filePathCallback.onReceiveValue(null)
                    return true
                }
                pendingFileChooser?.onReceiveValue(null)
                pendingFileChooser = filePathCallback
                return try {
                    audioFilePicker.launch(arrayOf("audio/*"))
                    true
                } catch (_: ActivityNotFoundException) {
                    pendingFileChooser = null
                    filePathCallback.onReceiveValue(null)
                    true
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val isExpectedAudioRequest = isTrustedMicOrigin(request.origin) &&
                        request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) &&
                        request.resources.all { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE }
                    if (!isExpectedAudioRequest || pendingMicRequest != null) {
                        request.deny()
                        return@runOnUiThread
                    }
                    if (ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.RECORD_AUDIO
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                    } else {
                        pendingMicRequest = request
                        micLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    }
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingMicRequest === request) pendingMicRequest = null
            }
        }
        web.loadUrl("$ASSET_ORIGIN/assets/index.html")
    }

    private fun isAssetUrl(uri: Uri): Boolean =
        uri.scheme == "https" &&
            uri.host == ASSET_HOST &&
            (uri.port == -1 || uri.port == 443) &&
            uri.path?.startsWith("/assets/") == true

    private fun isTrustedMicOrigin(origin: Uri): Boolean =
        origin.scheme?.equals("https", ignoreCase = true) == true &&
            origin.host?.equals(ASSET_HOST, ignoreCase = true) == true &&
            (origin.port == -1 || origin.port == 443)

    private fun isAllowedRemoteReadUrl(uri: Uri): Boolean {
        if (uri.scheme != "https" || (uri.port != -1 && uri.port != 443)) return false
        val path = uri.path ?: return false
        if (uri.host == "api.github.com") {
            return path == "/repos/$SAMPLE_OWNER/$SAMPLE_REPO/releases/latest" && uri.query == null
        }
        if (uri.host != "raw.githubusercontent.com") return false
        val prefix = "/$SAMPLE_OWNER/$SAMPLE_REPO/main/samples/"
        if (!path.startsWith(prefix)) return false
        val relative = path.removePrefix(prefix)
        return relative == "manifest.json" ||
            relative.matches(Regex("audio/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\.wav"))
    }

    override fun onPause() {
        if (::web.isInitialized) {
            web.evaluateJavascript("if(window.orfeyPause){window.orfeyPause()};if(window.orfeySamplesPause){window.orfeySamplesPause()}", null)
            web.onPause()
        }
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        if (::web.isInitialized) web.onResume()
    }

    override fun onDestroy() {
        pendingMicRequest?.let {
            try {
                it.deny()
            } catch (_: IllegalStateException) {
                // Ignore an already-cancelled WebView permission request.
            }
        }
        pendingMicRequest = null
        pendingFileChooser?.onReceiveValue(null)
        pendingFileChooser = null
        if (::web.isInitialized) {
            samplesBridge?.close()
            samplesBridge = null
            web.stopLoading()
            web.removeJavascriptInterface("OrfeyGitHub")
            web.loadUrl("about:blank")
            web.removeAllViews()
            web.destroy()
        }
        super.onDestroy()
    }

    private companion object {
        const val ASSET_HOST = "appassets.androidplatform.net"
        const val ASSET_ORIGIN = "https://appassets.androidplatform.net"
        const val SAMPLE_OWNER = "pdkiller666"
        const val SAMPLE_REPO = "Orfeus"
    }
}
