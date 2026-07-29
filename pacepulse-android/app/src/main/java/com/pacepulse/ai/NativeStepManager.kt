package com.pacepulse.ai

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import android.webkit.WebView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * PacePulse AI - Absolute 24/7 Hardware Step Counter Engine
 * Syncs exact today's step count using hardware baseline subtraction & updates Home Screen Widget
 */
object NativeStepManager {

    private const val PREFS_NAME = "pacepulse_hardware_prefs"
    private const val KEY_MIDNIGHT_BASELINE = "midnight_hardware_baseline"
    private const val KEY_BASELINE_DATE = "baseline_date"
    private const val KEY_TOTAL_STEPS_TODAY = "total_steps_today"

    private fun getTodayStr(): String {
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    }

    @Synchronized
    fun processCumulativeStep(context: Context, currentTotal: Float, webView: WebView?): Int {
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
                .putInt(KEY_TOTAL_STEPS_TODAY, 0)
                .apply()
            Log.d("PacePulseNative", "New Day Baseline Saved: $midnightBaseline for $todayStr")
        }

        // Calculate absolute steps taken today from hardware sensor
        val rawTodaySteps = (currentTotal - midnightBaseline).toInt()
        val todaySteps = if (rawTodaySteps < 0) 0 else rawTodaySteps

        prefs.edit().putInt(KEY_TOTAL_STEPS_TODAY, todaySteps).apply()

        if (webView != null) {
            webView.post {
                webView.evaluateJavascript(
                    "if(window.syncNativeTodaySteps){ window.syncNativeTodaySteps($todaySteps); }", null
                )
            }
        }

        // Update Android Home Screen AppWidget
        try {
            PacePulseWidget.updateAllWidgets(context)
        } catch (e: Exception) {}

        Log.d("PacePulseNative", "Current Hardware Total: $currentTotal | Midnight Baseline: $midnightBaseline | Today Steps: $todaySteps")
        return todaySteps
    }

    @Synchronized
    fun getSavedTodaySteps(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getInt(KEY_TOTAL_STEPS_TODAY, 0)
    }

    @Synchronized
    fun syncTodayStepsToWebView(context: Context, webView: WebView) {
        val todaySteps = getSavedTodaySteps(context)
        webView.post {
            webView.evaluateJavascript(
                "if(window.syncNativeTodaySteps){ window.syncNativeTodaySteps($todaySteps); }", null
            )
        }
        Log.d("PacePulseNative", "Synced $todaySteps saved steps to WebView on launch/resume")
    }

    @Synchronized
    fun resetBaseline(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .remove(KEY_MIDNIGHT_BASELINE)
            .remove(KEY_BASELINE_DATE)
            .putInt(KEY_TOTAL_STEPS_TODAY, 0)
            .apply()
        try {
            PacePulseWidget.updateAllWidgets(context)
        } catch (e: Exception) {}
        Log.d("PacePulseNative", "Native Step Manager Baseline Reset")
    }
}
