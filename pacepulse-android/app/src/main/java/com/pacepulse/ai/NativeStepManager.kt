package com.pacepulse.ai

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import android.webkit.WebView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * PacePulse AI - Monotonic Hardware Step Counter Engine
 * Transient Stride Buffer & Heel-Strike Shockwave Anti-Cheat Validation (Option A)
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

    // Transient Stride Buffer
    private var pendingBufferSteps: Int = 0
    private var consecutiveValidStrides: Int = 0
    private var recentGroundImpactCount: Int = 0

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

        // Track vertical ground impact shockwaves (heel strike alignment)
        if (Math.abs(z) >= 11.2f || lastAccelMagnitude >= 12.0f) {
            recentGroundImpactCount++
        }
    }

    /**
     * Transient Stride Candidate Validator
     * Verifies continuous cadence and heel-strike shockwave presence before committing buffer.
     */
    private fun validateCandidateStride(rawDelta: Int): Boolean {
        val now = System.currentTimeMillis()
        val timeDeltaMs = now - lastStepTimestampMs

        // 1. Cadence Guard: Rapid hand-shaking (> 190 SPM / < 315ms delta)
        if (timeDeltaMs in 1..314) {
            Log.w("PacePulseAntiCheat", "REJECTED: Rapid hand-shake cadence (${timeDeltaMs}ms). Buffer cleared.")
            pendingBufferSteps = 0
            consecutiveValidStrides = 0
            recentGroundImpactCount = 0
            lastStepTimestampMs = now
            return false
        }

        // 2. Violent Force Guard: Over 2.6g magnitude
        if (lastAccelMagnitude > 25.5f) {
            Log.w("PacePulseAntiCheat", "REJECTED: Violent hand-shaking force (${lastAccelMagnitude} m/s^2). Buffer cleared.")
            pendingBufferSteps = 0
            consecutiveValidStrides = 0
            recentGroundImpactCount = 0
            lastStepTimestampMs = now
            return false
        }

        // 3. Standing Arm-Swing Guard ("To & Fro" motion without vertical shockwave)
        val horizEnergy = lastAccelX * lastAccelX + lastAccelY * lastAccelY
        val vertEnergy = lastAccelZ * lastAccelZ
        if (horizEnergy > 3.8f * vertEnergy && recentGroundImpactCount == 0) {
            Log.w("PacePulseAntiCheat", "REJECTED: Standing arm-swing to & fro detected. Buffer cleared.")
            pendingBufferSteps = 0
            consecutiveValidStrides = 0
            recentGroundImpactCount = 0
            lastStepTimestampMs = now
            return false
        }

        // Reset buffer if paused for > 3.5s
        if (timeDeltaMs > 3500) {
            pendingBufferSteps = 0
            consecutiveValidStrides = 0
            recentGroundImpactCount = 0
        }

        pendingBufferSteps += rawDelta
        consecutiveValidStrides++
        lastStepTimestampMs = now

        // Gated Commit: Commit buffer once 3+ valid rhythmic strides are confirmed
        if (consecutiveValidStrides >= 3) {
            recentGroundImpactCount = 0
            return true
        }

        return false
    }

    @Synchronized
    fun setActiveUser(context: Context, uid: String?, webView: WebView? = null) {
        val newUid = sanitizeUid(uid)
        val todayStr = getTodayStr()
        val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        activeUid = newUid
        pendingBufferSteps = 0
        consecutiveValidStrides = 0
        recentGroundImpactCount = 0
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
        val rawDelta = if (isFirstTime) 0 else Math.max(0, (currentTotal - lastKnownHardwareTotal).toInt())
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

        // Validate stride candidate with Transient Buffer
        var stepsToCommit = 0
        if (!isFirstTime && rawDelta > 0) {
            if (validateCandidateStride(rawDelta)) {
                stepsToCommit = pendingBufferSteps
                pendingBufferSteps = 0
            }
        }

        val previousTodaySteps = prefs.getInt(keySteps, 0)
        val todaySteps = previousTodaySteps + stepsToCommit

        if (stepsToCommit > 0) {
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

        pendingBufferSteps = 0
        consecutiveValidStrides = 0
        recentGroundImpactCount = 0

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
