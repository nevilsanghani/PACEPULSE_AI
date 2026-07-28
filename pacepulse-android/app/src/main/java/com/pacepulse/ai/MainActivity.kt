package com.pacepulse.ai

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import kotlin.math.sqrt

/**
 * PacePulse AI - 100% Offline Self-Contained Native Android Application Window
 * Loads Embedded Local Android Asset Bundle (file:///android_asset/index.html)
 */
class MainActivity : ComponentActivity(), SensorEventListener {

    private lateinit var webView: WebView
    private lateinit var sensorManager: SensorManager
    private var accelerometer: Sensor? = null

    // Google Fit Accelerometer Motion Filter State
    private var gravityX = 0f
    private var gravityY = 0f
    private var gravityZ = 0f
    private val alpha = 0.8f

    private var lastStepTime = 0L
    private var candidateStepCount = 0
    private var lastCandidateTime = 0L

    private val windowSize = 5
    private val magBuffer = ArrayList<Float>()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize Hardware Accelerometer
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        // Native Full Screen WebView Container
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.allowFileAccessFromFileURLs = true
            settings.allowUniversalAccessFromFileURLs = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.cacheMode = WebSettings.LOAD_NO_CACHE

            webViewClient = object : WebViewClient() {
                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    Log.e("PacePulseWebView", "Error loading asset: ${error?.description} (${request?.url})")
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    Log.d("PacePulseJS", "${consoleMessage?.message()} -- From line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
                    return true
                }
            }

            // Load 100% self-contained local Android asset bundle (No Netlify or external URLs!)
            loadUrl("file:///android_asset/index.html")
        }

        setContentView(webView)
    }

    override fun onResume() {
        super.onResume()
        accelerometer?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
        }
    }

    override fun onPause() {
        super.onPause()
        sensorManager.unregisterListener(this)
    }

    // Google Fit 4-Step Verification Accelerometer Algorithm
    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor.type != Sensor.TYPE_ACCELEROMETER) return

        val rawX = event.values[0]
        val rawY = event.values[1]
        val rawZ = event.values[2]

        // Low-pass gravity isolation filter
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

        // Google Fit strict threshold (1.55 m/s²) + 4-step continuous rhythm verification
        if (smoothedMag > 1.55f && (now - lastStepTime) >= 280L && (now - lastStepTime) <= 1800L) {
            if (now - lastCandidateTime > 2200L) {
                candidateStepCount = 0
            }

            candidateStepCount++
            lastCandidateTime = now
            lastStepTime = now

            if (candidateStepCount >= 4) {
                val stepsToAdd = if (candidateStepCount == 4) 4 else 1
                webView.post {
                    webView.evaluateJavascript(
                        "if(window.addNativeSteps){ window.addNativeSteps($stepsToAdd); }", null
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
