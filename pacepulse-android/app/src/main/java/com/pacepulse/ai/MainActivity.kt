package com.pacepulse.ai

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler
import java.io.File
import java.io.FileOutputStream

/**
 * PacePulse AI - Native Android Application Window
 * Integrates Persistent 24/7 Hardware Step Engine & Instant JS Sync Bridge
 */
class MainActivity : ComponentActivity(), SensorEventListener {

    private lateinit var webView: WebView
    private lateinit var sensorManager: SensorManager
    private var stepCounterSensor: Sensor? = null
    private var pressureSensor: Sensor? = null

    // Web <input type="file"> chooser state (camera capture / gallery pick for the
    // share-card photo overlay feature)
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCameraImageUri: Uri? = null

    companion object {
        private const val REQUEST_ACTIVITY_RECOGNITION = 101
        private const val REQUEST_CAMERA_PERMISSION = 201
        private const val REQUEST_FILE_CHOOSER = 202
    }

    inner class AndroidStepBridge {
        @JavascriptInterface
        fun setActiveUser(uid: String?) {
            Log.d("PacePulseBridge", "setActiveUser called: $uid")
            runOnUiThread {
                NativeStepManager.setActiveUser(this@MainActivity, uid, webView)
                ElevationManager.setActiveUser(uid)
                ElevationManager.syncTodayElevationToWebView(this@MainActivity, webView)
            }
        }

        @JavascriptInterface
        fun resetNativeBaseline() {
            Log.d("PacePulseBridge", "Reset native baseline called from JavaScript")
            NativeStepManager.resetBaseline(this@MainActivity)
            ElevationManager.resetTodayElevation(this@MainActivity)
            runOnUiThread {
                ElevationManager.syncTodayElevationToWebView(this@MainActivity, webView)
            }
        }

        @JavascriptInterface
        fun requestInstantSync() {
            Log.d("PacePulseBridge", "Instant sync requested from JavaScript")
            runOnUiThread {
                NativeStepManager.syncTodayStepsToWebView(this@MainActivity, webView)
                ElevationManager.syncTodayElevationToWebView(this@MainActivity, webView)
            }
        }

        @JavascriptInterface
        fun updateWidgetData(steps: Int, goal: Int, activeKcal: Int, distanceKm: Double) {
            runOnUiThread {
                PacePulseWidgetHelper.updateWidgetMetrics(this@MainActivity, steps, goal, activeKcal, distanceKm)
            }
        }

        @JavascriptInterface
        fun setWidgetStyle(style: String) {
            Log.d("PacePulseBridge", "Set widget style called: $style")
            runOnUiThread {
                PacePulseWidgetHelper.updateAllWidgets(this@MainActivity)
            }
        }

        @JavascriptInterface
        fun shareToWhatsAppStatus(base64Jpeg: String, caption: String) {
            runOnUiThread {
                try {
                    val uri = writeShareImage(base64Jpeg) ?: return@runOnUiThread
                    val statusIntent = Intent("com.whatsapp.action.SHARE_TO_STATUS").apply {
                        type = "image/*"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        putExtra(Intent.EXTRA_TEXT, caption)
                        clipData = ClipData.newRawUri("image", uri)
                        setPackage("com.whatsapp")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }

                    if (statusIntent.resolveActivity(packageManager) != null) {
                        startActivity(statusIntent)
                    } else {
                        shareViaGenericSend(uri, caption, "com.whatsapp", "com.whatsapp")
                    }
                } catch (e: Exception) {
                    Log.e("PacePulseBridge", "shareToWhatsAppStatus failed: ${e.message}")
                }
            }
        }

        @JavascriptInterface
        fun shareToInstagramStory(base64Jpeg: String) {
            runOnUiThread {
                try {
                    val uri = writeShareImage(base64Jpeg) ?: return@runOnUiThread
                    val storyIntent = Intent("com.instagram.share.ADD_TO_STORY").apply {
                        setDataAndType(uri, "image/*")
                        putExtra("source_application", packageName)
                        setPackage("com.instagram.android")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }

                    if (storyIntent.resolveActivity(packageManager) != null) {
                        startActivity(storyIntent)
                    } else {
                        shareViaGenericSend(uri, null, "com.instagram.android", "com.instagram.android")
                    }
                } catch (e: Exception) {
                    Log.e("PacePulseBridge", "shareToInstagramStory failed: ${e.message}")
                }
            }
        }

        /**
         * Saves a base64-encoded image straight into the device's Photos gallery via
         * MediaStore - a plain `<a download>` click inside the WebView silently does
         * nothing, since WebView has no built-in handler for data: URI downloads.
         */
        @JavascriptInterface
        fun saveImageToGallery(base64Image: String, fileName: String) {
            runOnUiThread {
                try {
                    val bytes = Base64.decode(base64Image, Base64.DEFAULT)
                    val resolver = contentResolver

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val values = ContentValues().apply {
                            put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
                            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/PacePulse")
                            put(MediaStore.Images.Media.IS_PENDING, 1)
                        }
                        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                        if (uri == null) {
                            Toast.makeText(this@MainActivity, "Could not save image", Toast.LENGTH_SHORT).show()
                            return@runOnUiThread
                        }
                        resolver.openOutputStream(uri)?.use { it.write(bytes) }
                        values.clear()
                        values.put(MediaStore.Images.Media.IS_PENDING, 0)
                        resolver.update(uri, values, null, null)
                    } else {
                        // Pre-scoped-storage (API < 29): write directly to the public
                        // Pictures directory and register it with the media scanner.
                        val picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
                        val targetDir = File(picturesDir, "PacePulse").apply { mkdirs() }
                        val targetFile = File(targetDir, fileName)
                        FileOutputStream(targetFile).use { it.write(bytes) }
                        MediaScannerConnection.scanFile(this@MainActivity, arrayOf(targetFile.absolutePath), arrayOf("image/png"), null)
                    }

                    Toast.makeText(this@MainActivity, "Saved to Photos", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    Log.e("PacePulseBridge", "saveImageToGallery failed: ${e.message}")
                    Toast.makeText(this@MainActivity, "Could not save image", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    /** Decodes a base64 JPEG, writes it to cache, and returns a FileProvider content:// URI. */
    private fun writeShareImage(base64Jpeg: String): Uri? {
        return try {
            val bytes = Base64.decode(base64Jpeg, Base64.DEFAULT)
            val dir = File(cacheDir, "share").apply { mkdirs() }
            val file = File(dir, "pacepulse_share.jpg")
            FileOutputStream(file).use { it.write(bytes) }
            FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        } catch (e: Exception) {
            Log.e("PacePulseBridge", "writeShareImage failed: ${e.message}")
            null
        }
    }

    /**
     * Entry point for the web <input type="file"> "Take Photo / Upload Image" control.
     * Requests CAMERA permission first (if not already granted) before offering the
     * camera option, per the requirement that permission must be asked before the
     * camera itself is opened - a denial just falls back to gallery-only selection
     * rather than blocking the feature entirely.
     */
    private fun launchImageChooser() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), REQUEST_CAMERA_PERMISSION)
            return
        }
        openImageChooser(allowCamera = true)
    }

    /** Combines a camera-capture intent and a gallery picker into a single chooser dialog. */
    private fun openImageChooser(allowCamera: Boolean) {
        val galleryIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "image/*"
            addCategory(Intent.CATEGORY_OPENABLE)
        }

        var cameraIntent: Intent? = null
        if (allowCamera) {
            try {
                val dir = File(cacheDir, "share").apply { mkdirs() }
                val photoFile = File(dir, "camera_capture_${System.currentTimeMillis()}.jpg")
                val cameraUri = FileProvider.getUriForFile(this, "$packageName.fileprovider", photoFile)
                pendingCameraImageUri = cameraUri
                cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                    putExtra(MediaStore.EXTRA_OUTPUT, cameraUri)
                    addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                }
            } catch (e: Exception) {
                Log.e("PacePulseBridge", "Camera intent setup failed: ${e.message}")
            }
        }

        val chooserIntent = Intent.createChooser(galleryIntent, "Choose or Capture a Photo")
        if (cameraIntent != null && cameraIntent.resolveActivity(packageManager) != null) {
            chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
        }

        try {
            @Suppress("DEPRECATION")
            startActivityForResult(chooserIntent, REQUEST_FILE_CHOOSER)
        } catch (e: ActivityNotFoundException) {
            filePathCallback?.onReceiveValue(null)
            filePathCallback = null
        }
    }

    /**
     * Falls back to a generic ACTION_SEND targeted at the given package (opens that app's
     * own share/contact picker) when the app-specific Story/Status intent doesn't resolve;
     * if the app isn't installed at all, opens its Play Store listing instead.
     */
    private fun shareViaGenericSend(uri: Uri, caption: String?, targetPackage: String, playStorePackage: String) {
        val sendIntent = Intent(Intent.ACTION_SEND).apply {
            type = "image/*"
            putExtra(Intent.EXTRA_STREAM, uri)
            if (caption != null) putExtra(Intent.EXTRA_TEXT, caption)
            clipData = ClipData.newRawUri("image", uri)
            setPackage(targetPackage)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        try {
            if (sendIntent.resolveActivity(packageManager) != null) {
                startActivity(sendIntent)
            } else {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$playStorePackage")))
            }
        } catch (e: ActivityNotFoundException) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$playStorePackage")))
            } catch (e2: Exception) {
                Log.e("PacePulseBridge", "shareViaGenericSend fallback failed: ${e2.message}")
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request Activity Recognition & Notification Permissions
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val perms = mutableListOf(Manifest.permission.ACTIVITY_RECOGNITION)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                perms.add(Manifest.permission.POST_NOTIFICATIONS)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, perms.toTypedArray(), REQUEST_ACTIVITY_RECOGNITION)
            }
        }

        // Start 24/7 Step Service
        startSmartStepService()

        // Classify live motion (walking vs in-vehicle vs still) so false steps from
        // vehicle vibration can be excluded, and elevation gain only accrues while walking
        NativeStepManager.registerMotionTransitionUpdates(this)

        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        pressureSensor = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.cacheMode = WebSettings.LOAD_NO_CACHE

            addJavascriptInterface(AndroidStepBridge(), "AndroidStepBridge")

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    return request?.url?.let { assetLoader.shouldInterceptRequest(it) }
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    NativeStepManager.syncTodayStepsToWebView(this@MainActivity, webView)
                    PacePulseWidgetHelper.updateAllWidgets(this@MainActivity)
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    Log.e("PacePulseWebView", "Asset error: ${error?.description} (${request?.url})")
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    Log.d("PacePulseJS", "${consoleMessage?.message()}")
                    return true
                }

                override fun onShowFileChooser(
                    webView: WebView?,
                    callback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = callback
                    launchImageChooser()
                    return true
                }
            }

            loadUrl("https://appassets.androidplatform.net/index.html")
        }

        setContentView(webView)
    }

    private fun startSmartStepService() {
        try {
            val serviceIntent = Intent(this, StepTrackingService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {
            Log.e("PacePulseService", "Error starting step service: ${e.message}")
        }
    }

    override fun onResume() {
        super.onResume()
        startSmartStepService()

        stepCounterSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
        }

        val accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        accelSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }

        val pSensor = pressureSensor
        if (pSensor != null) {
            sensorManager.registerListener(this, pSensor, SensorManager.SENSOR_DELAY_NORMAL)
        } else {
            ElevationManager.reportUnsupported(this, webView)
        }

        NativeStepManager.syncTodayStepsToWebView(this, webView)
        ElevationManager.syncTodayElevationToWebView(this, webView)
    }

    override fun onPause() {
        super.onPause()
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return

        if (event.sensor.type == Sensor.TYPE_ACCELEROMETER) {
            NativeStepManager.updateAccelerometer(event.values[0], event.values[1], event.values[2])
        } else if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
            NativeStepManager.processCumulativeStep(this, event.values[0], webView)
        } else if (event.sensor.type == Sensor.TYPE_PRESSURE) {
            ElevationManager.processPressureSample(this, event.values[0], webView)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_ACTIVITY_RECOGNITION && grantResults.any { it == PackageManager.PERMISSION_GRANTED }) {
            NativeStepManager.registerMotionTransitionUpdates(this)
        } else if (requestCode == REQUEST_CAMERA_PERMISSION) {
            val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            // Denied is still a valid outcome for the share-photo feature - just offer
            // gallery selection instead of blocking the whole "Take Photo / Upload
            // Image" control.
            openImageChooser(allowCamera = granted)
        }
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_FILE_CHOOSER) return

        val callback = filePathCallback
        filePathCallback = null
        if (callback == null) return

        if (resultCode != RESULT_OK) {
            callback.onReceiveValue(null)
            return
        }

        // A gallery pick returns its own content:// Uri in `data`; a camera capture
        // returns no data at all since the photo was written directly to the Uri we
        // supplied as EXTRA_OUTPUT when launching it.
        val resultUri = data?.data ?: pendingCameraImageUri
        callback.onReceiveValue(if (resultUri != null) arrayOf(resultUri) else null)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
