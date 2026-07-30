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
 * Per-User Isolated Baselines & Biomechanical Anti-Cheat Hand-Shake/Arm-Swing Filtering
 */
object NativeStepManager {

    private const val PREFS_NAME = "pacepulse_hardware_prefs"
    private var activeUid: String = "guest"
    private var lastKnownHardwareTotal: Float = -1f

    // Anti-Cheat & Biomechanical Motion State
    private var lastStepTimestampMs: Long = 0L
    private var lastAccelX: Float = 0f
    private var lastAccelY: Float = 0f
    private var lastAccelZ: Float = 9.81f
    private var lastAccelMagnitude: Float = 9.81f
    private var consecutiveValidStrides: Int = 0

    private fun getTodayStr(): String {
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    }

    private fun sanitizeUid(uid: String?): String {
        val clean = (uid ?: "guest").trim().lowercase().replace("[^a-z0-9_]".toRegex(), "_")
        return if (clean.isEmpty()) "guest" else clean
    }

    @Synchronized
    fun updateAccelerometer(x: Float, y: Float, z: Float) {
        lastAccelX = x
        lastAccelY = y
        lastAccelZ = z
        lastAccelMagnitude = Math.sqrt((x * x + y * y + z * z).toDouble()).toFloat()
    }

    /**
     * Biomechanical Motion Anti-Cheat Validator
     * Returns true ONLY IF movement matches real human walking/running locomotion:
     * 1. Cadence Guard (Rejects rapid hand shaking > 185 SPM / < 320ms per step)
     * 2. Violent G-Force Guard (Rejects hand shaking exceeding 2.6g / 25.5 m/s^2)
     * 3. Vertical Impact & Energy Ratio Guard (Rejects standing arm-swings to & fro)
     */
    private fun isRealHumanStride(currentTotal: Float): Boolean {
        val now = System.currentTimeMillis()
        val timeDeltaMs = now - lastStepTimestampMs

        // 1. Cadence Guard: If steps arrive faster than 320ms apart (over 187 steps/min), it's rapid hand shaking!
        if (timeDeltaMs in 1..319) {
            Log.w("PacePulseAntiCheat", "REJECTED: Rapid hand-shaking detected (cadence delta ${timeDeltaMs}ms)")
            return false
        }

        // 2. Violent Force Guard: If total magnitude > 25.5 m/s^2 (~2.6g), it's a violent hand shake
        if (lastAccelMagnitude > 25.5f) {
            Log.w("PacePulseAntiCheat", "REJECTED: Violent hand-shaking G-force (${lastAccelMagnitude} m/s^2)")
            return false
        }

        // 3. Standing Arm-Swing Guard ("To & Fro" movement while standing still)
        // In real walking, vertical axis (Z or gravity-aligned) has a distinct impact peak of 11.5 - 18.0 m/s^2.
        // In standing arm swings, horizontal energy (X/Y) is high while vertical impact (Z) is weak or flat.
        val horizEnergy = lastAccelX * lastAccelX + lastAccelY * lastAccelY
        val vertEnergy = lastAccelZ * lastAccelZ

        // If standing still and moving arm to-and-fro, horizEnergy dominates vertEnergy (> 3.5x) & vert impact is weak
        if (horizEnergy > 3.5f * vertEnergy && Math.abs(lastAccelZ) < 11.2f) {
            Log.w("PacePulseAntiCheat", "REJECTED: Standing arm-swing to & fro detected (horiz: $horizEnergy, vert: $vertEnergy)")
            return false
        }

        // Step Cadence Reset: If idle > 3.5s, reset stride continuity buffer
        if (timeDeltaMs > 3500) {
            consecutiveValidStrides = 1
        } else {
            consecutiveValidStrides++
        }

        lastStepTimestampMs = now
        return true
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
        val isFirstTime = (lastKnownHardwareTotal < 0f)
        val rawDelta = if (isFirstTime) 0 else (currentTotal - lastKnownHardwareTotal).toInt()
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

        // Validate step candidate with anti-cheat biomechanics filter!
        if (!isFirstTime && rawDelta > 0) {
            if (!isRealHumanStride(currentTotal)) {
                // Adjust baseline forward so fake hardware steps are discarded!
                midnightBaseline += rawDelta
                prefs.edit().putFloat(keyBaseline, midnightBaseline).apply()
                Log.w("PacePulseAntiCheat", "Discarded $rawDelta fake step(s)! Baseline adjusted to $midnightBaseline")
            }
        }

        // Calculate absolute steps taken today by active user from hardware sensor
        val rawTodaySteps = (currentTotal - midnightBaseline).toInt()
        val todaySteps = if (rawTodaySteps < 0) 0 else rawTodaySteps

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
