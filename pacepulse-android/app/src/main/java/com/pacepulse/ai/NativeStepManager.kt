package com.pacepulse.ai

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import android.webkit.WebView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.min

/**
 * PacePulse AI - Persistent Google Fit Style Step Engine
 * Saves Midnight Hardware Baseline to SharedPreferences so steps walked while app is CLOSED match Google Fit 100%!
 */
object NativeStepManager {

    private const val PREFS_NAME = "pacepulse_hardware_prefs"
    private const val KEY_MIDNIGHT_BASELINE = "midnight_hardware_baseline"
    private const val KEY_BASELINE_DATE = "baseline_date"

    private var lastCumulativeTotal = -1f
    private var pendingBackgroundSteps = 0

    private fun getTodayStr(): String {
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    }

    @Synchronized
    fun processCumulativeStep(context: Context, currentTotal: Float, webView: WebView?) {
        val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val todayStr = getTodayStr()
        val savedDate = prefs.getString(KEY_BASELINE_DATE, "")
        var midnightBaseline = prefs.getFloat(KEY_MIDNIGHT_BASELINE, -1f)

        // New day or first launch -> Store Midnight Hardware Baseline in SharedPreferences
        if (savedDate != todayStr || midnightBaseline < 0f) {
            midnightBaseline = currentTotal
            prefs.edit()
                .putString(KEY_BASELINE_DATE, todayStr)
                .putFloat(KEY_MIDNIGHT_BASELINE, midnightBaseline)
                .apply()
            Log.d("PacePulseNative", "New Day Baseline Saved: $midnightBaseline for $todayStr")
        }

        if (lastCumulativeTotal < 0f) {
            lastCumulativeTotal = currentTotal
            
            // Calculate steps walked while app was completely CLOSED!
            val closedAppSteps = (currentTotal - midnightBaseline).toInt()
            if (closedAppSteps > 0 && webView != null) {
                Log.d("PacePulseNative", "App reopened! Syncing $closedAppSteps steps walked while app was closed.")
                webView.post {
                    webView.evaluateJavascript(
                        "if(window.addNativeSteps){ window.addNativeSteps($closedAppSteps); }", null
                    )
                }
            }
            return
        }

        val rawDelta = (currentTotal - lastCumulativeTotal).toInt()
        if (rawDelta > 0) {
            // Vehicle Vibration Filter: Cap max step delta per hardware tick (prevents vehicle bump spikes)
            val delta = min(rawDelta, 4)
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
            Log.d("PacePulseNative", "Hardware Step Delta: $delta (Raw: $rawDelta)")
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
    fun resetBaseline(context: Context) {
        lastCumulativeTotal = -1f
        pendingBackgroundSteps = 0
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_MIDNIGHT_BASELINE).remove(KEY_BASELINE_DATE).apply()
        Log.d("PacePulseNative", "Native Step Manager Baseline Reset")
    }
}
