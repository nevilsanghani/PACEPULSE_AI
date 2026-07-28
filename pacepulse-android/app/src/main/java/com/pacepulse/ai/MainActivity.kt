package com.pacepulse.ai

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler
import kotlin.math.sqrt

/**
 * PacePulse AI - 100% Offline Native Android Application Window
 * Uses AndroidX WebViewAssetLoader for 100% local ES module & sensor execution
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

        // AndroidX WebViewAssetLoader for offline local asset serving (bypasses file:// CORS & ES module restriction)
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
            }

            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    Log.d("PacePulseJS", "${consoleMessage?.message()} -- From line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
                    return true
                }
            }

            // Load local asset via AndroidX WebViewAssetLoader domain (100% Offline, Zero Netlify!)
            loadUrl("https://appassets.androidplatform.net/index.html")
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
