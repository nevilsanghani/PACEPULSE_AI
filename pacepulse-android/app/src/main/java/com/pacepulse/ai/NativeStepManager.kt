package com.pacepulse.ai

import android.util.Log
import android.webkit.WebView
import kotlin.math.min

/**
 * PacePulse AI - Unified Native Step Manager Singleton
 * Prevents step jumps (+50) and handles instant Reset Baseline synchronization
 */
object NativeStepManager {

    private var lastCumulativeTotal = -1f
    private var pendingBackgroundSteps = 0

    @Synchronized
    fun processCumulativeStep(currentTotal: Float, webView: WebView?) {
        if (lastCumulativeTotal < 0f) {
            // Initial Baseline on app launch or reset
            lastCumulativeTotal = currentTotal
            Log.d("PacePulseNative", "Hardware Step Counter Baseline set to $currentTotal")
            return
        }

        val rawDelta = (currentTotal - lastCumulativeTotal).toInt()
        if (rawDelta > 0) {
            // Cap delta at 5 steps per event tick to prevent sudden massive jumps (+50)
            val delta = min(rawDelta, 5)
            lastCumulativeTotal = currentTotal

            if (webView != null) {
                webView.post {
                    webView.evaluateJavascript(
                        "if(window.addNativeSteps){ window.addNativeSteps($delta); }", null
                    )
                }
            } else {
                pendingBackgroundSteps += delta
            }
            Log.d("PacePulseNative", "Step Delta: $delta (Raw: $rawDelta)")
        }
    }

    @Synchronized
    fun processSingleStepDetectorEvent(webView: WebView?) {
        if (webView != null) {
            webView.post {
                webView.evaluateJavascript(
                    "if(window.addNativeSteps){ window.addNativeSteps(1); }", null
                )
            }
        } else {
            pendingBackgroundSteps += 1
        }
    }

    @Synchronized
    fun flushPendingBackgroundSteps(webView: WebView) {
        if (pendingBackgroundSteps > 0) {
            val count = pendingBackgroundSteps
            pendingBackgroundSteps = 0
            webView.post {
                webView.evaluateJavascript(
                    "if(window.addNativeSteps){ window.addNativeSteps($count); }", null
                )
            }
            Log.d("PacePulseNative", "Flushed $count background steps to WebView")
        }
    }

    @Synchronized
    fun resetBaseline() {
        lastCumulativeTotal = -1f
        pendingBackgroundSteps = 0
        Log.d("PacePulseNative", "Native Step Manager Baseline Reset")
    }
}
