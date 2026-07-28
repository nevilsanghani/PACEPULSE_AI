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
 * PacePulse AI - High Precision Native Android Application Window
 * Starts Smart Battery-Optimized StepTrackingService on Motion (Auto-Stops after 2 Minutes Idle)
 */
class MainActivity : ComponentActivity(), SensorEventListener {

    private lateinit var webView: WebView
    private lateinit var sensorManager: SensorManager
    private var stepCounterSensor: Sensor? = null
    private var stepDetectorSensor: Sensor? = null
    private var accelerometerSensor: Sensor? = null

    private var lastCumulativeStepCount = -1f

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
            val perms = mutableListOf(Manifest.permission.ACTIVITY_RECOGNITION)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                perms.add(Manifest.permission.POST_NOTIFICATIONS)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, perms.toTypedArray(), 101)
            }
        }

        // Start Smart Background Step Tracking Service
        startSmartStepService()

        // Initialize Native Hardware Step Sensors
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
        accelerometerSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

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
        stepDetectorSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
        }
        accelerometerSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
        }

        // Flush any background steps counted on motion while screen was turned off
        val backgroundSteps = StepTrackingService.backgroundStepsDelta
        if (backgroundSteps > 0) {
            StepTrackingService.backgroundStepsDelta = 0
            webView.post {
                webView.evaluateJavascript(
                    "if(window.addNativeSteps){ window.addNativeSteps($backgroundSteps); }", null
                )
            }
        }
    }

    override fun onPause() {
        super.onPause()
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return

        // Motion detected -> ensure background service is active
        if (!StepTrackingService.isServiceRunning) {
            startSmartStepService()
        }

        if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
            val currentTotal = event.values[0]
            if (lastCumulativeStepCount < 0f) {
                lastCumulativeStepCount = currentTotal
            } else {
                val delta = (currentTotal - lastCumulativeStepCount).toInt()
                if (delta > 0) {
                    lastCumulativeStepCount = currentTotal
                    webView.post {
                        webView.evaluateJavascript(
                            "if(window.addNativeSteps){ window.addNativeSteps($delta); }", null
                        )
                    }
                }
            }
            return
        }

        if (event.sensor.type == Sensor.TYPE_STEP_DETECTOR && stepCounterSensor == null) {
            val stepsDetected = event.values[0].toInt()
            webView.post {
                webView.evaluateJavascript(
                    "if(window.addNativeSteps){ window.addNativeSteps($stepsDetected); }", null
                )
            }
            return
        }

        if (event.sensor.type == Sensor.TYPE_ACCELEROMETER && stepCounterSensor == null && stepDetectorSensor == null) {
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

            if (smoothedMag > 0.65f && (now - lastStepTime) >= 150L && (now - lastStepTime) <= 1800L) {
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
