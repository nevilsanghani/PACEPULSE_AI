package com.pacepulse.ai

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Bundle
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
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler

/**
 * PacePulse AI - Native Android Application Window
 * Integrates Persistent 24/7 Hardware Step Engine & Instant JS Sync Bridge
 */
class MainActivity : ComponentActivity(), SensorEventListener {

    private lateinit var webView: WebView
    private lateinit var sensorManager: SensorManager
    private var stepCounterSensor: Sensor? = null

    inner class AndroidStepBridge {
        @JavascriptInterface
        fun setActiveUser(uid: String?) {
            Log.d("PacePulseBridge", "setActiveUser called: $uid")
            runOnUiThread {
                NativeStepManager.setActiveUser(this@MainActivity, uid, webView)
            }
        }

        @JavascriptInterface
        fun resetNativeBaseline() {
            Log.d("PacePulseBridge", "Reset native baseline called from JavaScript")
            NativeStepManager.resetBaseline(this@MainActivity)
        }

        @JavascriptInterface
        fun requestInstantSync() {
            Log.d("PacePulseBridge", "Instant sync requested from JavaScript")
            runOnUiThread {
                NativeStepManager.syncTodayStepsToWebView(this@MainActivity, webView)
            }
        }

        @JavascriptInterface
        fun setWidgetStyle(style: String) {
            Log.d("PacePulseBridge", "Set widget style called: $style")
            runOnUiThread {
                PacePulseWidgetHelper.updateAllWidgets(this@MainActivity)
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

        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

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

        NativeStepManager.syncTodayStepsToWebView(this, webView)
    }

    override fun onPause() {
        super.onPause()
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return

        if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
            NativeStepManager.processCumulativeStep(this, event.values[0], webView)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
