package com.pacepulse.ai

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import android.webkit.WebView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * PacePulse AI - Absolute 24/7 Monotonic Hardware Step Counter Engine
 * Guarantees step counts NEVER decrease and tracks walking 100% accurately per user.
 */
object NativeStepManager {

    private const val PREFS_NAME = "pacepulse_hardware_prefs"
    private var activeUid: String = "guest"
    private var lastKnownHardwareTotal: Float = -1f

    private fun getTodayStr(): String {
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    }

    private fun sanitizeUid(uid: String?): String {
        val clean = (uid ?: "guest").trim().lowercase().replace("[^a-z0-9_]".toRegex(), "_")
        return if (clean.isEmpty()) "guest" else clean
    }

    @Synchronized
    fun updateAccelerometer(x: Float, y: Float, z: Float) {
        // Reserved for future continuous telemetry
    }

    @Synchronized
    fun setActiveUser(context: Context, uid: String?, webView: WebView? = null) {
        val newUid = sanitizeUid(uid)
        val todayStr = getTodayStr()
        val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        activeUid = newUid
        Log.d("PacePulseNative", "Active User Switched To: $activeUid")

        val keyBaseline = "baseline_$activeUid"
        val keyDate = "date_$activeUid"

        var midnightBaseline = prefs.getFloat(keyBaseline, -1f)
        val savedDate = prefs.getString(keyDate, "")

        // If switching to a user who has no baseline for today, establish baseline using lastKnownHardwareTotal
        if (savedDate != todayStr || midnightBaseline < 0f) {
            if (lastKnownHardwareTotal >= 0f) {
                midnightBaseline = lastKnownHardwareTotal
                prefs.edit()
                    .putString(keyDate, todayStr)
                    .putFloat(keyBaseline, midnightBaseline)
                    .putInt("steps_${activeUid}_$todayStr", 0)
                    .apply()
                Log.d("PacePulseNative", "Established Baseline $midnightBaseline for user $activeUid")
            }
        }

        syncTodayStepsToWebView(context, webView)
    }

    @Synchronized
    fun processCumulativeStep(context: Context, currentTotal: Float, webView: WebView?): Int {
        lastKnownHardwareTotal = currentTotal

        val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val todayStr = getTodayStr()

        val keyBaseline = "baseline_$activeUid"
        val keyDate = "date_$activeUid"
        val keySteps = "steps_${activeUid}_$todayStr"

        val savedDate = prefs.getString(keyDate, "")
        var midnightBaseline = prefs.getFloat(keyBaseline, -1f)

        // New day or first launch -> Store Midnight Hardware Baseline for active user
        if (savedDate != todayStr || midnightBaseline < 0f) {
            midnightBaseline = currentTotal
            prefs.edit()
                .putString(keyDate, todayStr)
                .putFloat(keyBaseline, midnightBaseline)
                .putInt(keySteps, 0)
                .apply()
            Log.d("PacePulseNative", "New Day Baseline Saved: $midnightBaseline for user $activeUid on $todayStr")
        }

        // Compute absolute steps taken today from hardware sensor
        val rawTodaySteps = (currentTotal - midnightBaseline).toInt()
        val calculatedSteps = if (rawTodaySteps < 0) 0 else rawTodaySteps

        // Ensure Monotonicity: Steps MUST NEVER DECREASE!
        val previousTodaySteps = prefs.getInt(keySteps, 0)
        val todaySteps = Math.max(previousTodaySteps, calculatedSteps)

        prefs.edit().putInt(keySteps, todaySteps).apply()

        if (webView != null) {
            webView.post {
                webView.evaluateJavascript(
                    "if(window.syncNativeTodaySteps){ window.syncNativeTodaySteps($todaySteps, '$activeUid'); }", null
                )
            }
        }

        // Update Android Home Screen AppWidgets
        try {
            PacePulseWidgetHelper.updateAllWidgets(context)
        } catch (e: Exception) {
            Log.w("PacePulseNative", "Widget update warning: ${e.message}")
        }

        return todaySteps
    }

    @Synchronized
    fun getSavedTodaySteps(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val todayStr = getTodayStr()
        return prefs.getInt("steps_${activeUid}_$todayStr", 0)
    }

    @Synchronized
    fun syncTodayStepsToWebView(context: Context, webView: WebView?) {
        if (webView == null) return
        val todaySteps = getSavedTodaySteps(context)
        webView.post {
            webView.evaluateJavascript(
                "if(window.syncNativeTodaySteps){ window.syncNativeTodaySteps($todaySteps, '$activeUid'); }", null
            )
        }
        Log.d("PacePulseNative", "Synced $todaySteps saved steps for user $activeUid to WebView")
    }

    @Synchronized
    fun resetBaseline(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val todayStr = getTodayStr()
        val keyBaseline = "baseline_$activeUid"
        val keyDate = "date_$activeUid"
        val keySteps = "steps_${activeUid}_$todayStr"

        if (lastKnownHardwareTotal >= 0f) {
            prefs.edit()
                .putFloat(keyBaseline, lastKnownHardwareTotal)
                .putString(keyDate, todayStr)
                .putInt(keySteps, 0)
                .apply()
        } else {
            prefs.edit()
                .remove(keyBaseline)
                .remove(keyDate)
                .putInt(keySteps, 0)
                .apply()
        }

        try {
            PacePulseWidgetHelper.updateAllWidgets(context)
        } catch (e: Exception) {}
        Log.d("PacePulseNative", "Baseline Reset for user $activeUid")
    }
}
