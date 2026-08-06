package com.pacepulse.ai

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
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
                ActivityCompat.requestPermissions(this, perms.toTypedArray(), 101)
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
        if (requestCode == 101 && grantResults.any { it == PackageManager.PERMISSION_GRANTED }) {
            NativeStepManager.registerMotionTransitionUpdates(this)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
