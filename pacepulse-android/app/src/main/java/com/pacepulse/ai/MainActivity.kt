package com.pacepulse.ai

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
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
import kotlin.math.sqrt

/**
 * PacePulse AI - Native Android Application Window
 * Uses Android Hardware STEP_DETECTOR Sensor (Hardware Step Chip) + Accelerometer Fallback
 */
class MainActivity : ComponentActivity(), SensorEventListener {

    private lateinit var webView: WebView
    private lateinit var sensorManager: SensorManager
    private var stepDetectorSensor: Sensor? = null
    private var accelerometerSensor: Sensor? = null

    // Accelerometer Filter Fallback State
    private var gravityX = 0f
    private var gravityY = 0f
    private var gravityZ = 0f
    private val alpha = 0.8f

    private var lastStepTime = 0L
    private val windowSize = 4
    private val magBuffer = ArrayList<Float>()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request Activity Recognition & Sensor Runtime Permissions for Android 10+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.ACTIVITY_RECOGNITION), 101)
            }
        }

        // Initialize Native Hardware Step Detector Chip & Accelerometer
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
        accelerometerSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        // AndroidX WebViewAssetLoader for 100% offline local asset rendering
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", AssetsPathHandler(this))
            .build()

        // Native Full Screen WebView Container
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.cacheMode = WebSettings.LOAD_DEFAULT

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    return request?.url?.let { assetLoader.shouldInterceptRequest(it) }
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

            // Load 100% offline local app asset
            loadUrl("https://appassets.androidplatform.net/index.html")
        }

        setContentView(webView)
    }

    override fun onResume() {
        super.onResume()
        // Register Hardware Step Detector first
        stepDetectorSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
        }
        // Fallback Accelerometer
        accelerometerSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
        }
    }

    override fun onPause() {
        super.onPause()
        sensorManager.unregisterListener(this)
    }

    // Native Android Hardware Step Detection Interrupt
    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return

        // Primary: Hardware Step Detector Sensor Chip
        if (event.sensor.type == Sensor.TYPE_STEP_DETECTOR) {
            val stepsDetected = event.values[0].toInt()
            Log.d("PacePulseHardware", "Hardware Step Detected: $stepsDetected")
            webView.post {
                webView.evaluateJavascript(
                    "if(window.addNativeSteps){ window.addNativeSteps($stepsDetected); }", null
                )
            }
            return
        }

        // Secondary Fallback: Accelerometer Sensor
        if (event.sensor.type == Sensor.TYPE_ACCELEROMETER && stepDetectorSensor == null) {
            val rawX = event.values[0]
            val rawY = event.values[1]
            val rawZ = event.values[2]

            gravityX = alpha * gravityX + (1 - alpha) * rawX
            gravityY = alpha * gravityY + (1 - alpha) * rawY
            gravityZ = alpha * gravityZ + (1 - alpha) * rawZ

            val userX = rawX - gravityX
            val userY = rawY - gravityY
            val userZ = rawZ - gravityZ

            val userMagnitude = sqrt(userX * userX + userY * userY + userZ * userZ)

            magBuffer.add(userMagnitude)
            if (magBuffer.size > windowSize) magBuffer.removeAt(0)

            var sum = 0f
            for (m in magBuffer) sum += m
            val smoothedMag = sum / magBuffer.size

            val now = System.currentTimeMillis()

            if (smoothedMag > 0.75f && (now - lastStepTime) >= 180L && (now - lastStepTime) <= 1800L) {
                lastStepTime = now
                webView.post {
                    webView.evaluateJavascript(
                        "if(window.addNativeSteps){ window.addNativeSteps(1); }", null
                    )
                }
            }
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
