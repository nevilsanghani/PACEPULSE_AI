package com.pacepulse.ai

import android.content.Context
import android.content.SharedPreferences
import android.hardware.SensorManager
import android.util.Log
import android.webkit.WebView
import com.google.android.gms.location.DetectedActivity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * PacePulse AI - Barometric Elevation Gain Engine
 * Accumulates real elevation gain (meters climbed) from the barometer, rejecting:
 *  - Elevators/escalators: no accrual unless the user is actively WALKING/RUNNING
 *    (per NativeStepManager's Activity Recognition motion state)
 *  - Sensor noise: a small deadband ignores barometer jitter
 *  - Implausible spikes: a max human stair-climb rate caps any single sample
 * Gracefully reports "unsupported" on devices without a barometer instead of faking data.
 */
object ElevationManager {

    private const val NOISE_DEADBAND_M = 0.18f
    private const val MAX_CLIMB_RATE_M_PER_S = 0.5f

    private var activeUid: String = "guest"
    private var smoothedPressure: Float = -1f
    private var lastAltitude: Float = Float.NaN
    private var lastSampleTimeMs: Long = -1L

    private fun getTodayStr(): String {
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    }

    private fun prefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(NativeStepManager.PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun setActiveUser(uid: String?) {
        activeUid = (uid ?: "guest").trim().lowercase().replace("[^a-z0-9_]".toRegex(), "_").ifEmpty { "guest" }
    }

    /** Called once at startup when no barometer sensor exists on this device. */
    fun reportUnsupported(context: Context, webView: WebView?) {
        syncTodayElevationToWebView(context, webView, supportedOverride = false)
    }

    @Synchronized
    fun processPressureSample(context: Context, pressureHpa: Float, webView: WebView?) {
        val now = System.currentTimeMillis()

        // Seed on first sample of this sensor session - never diff against a stale/unset value.
        if (smoothedPressure < 0f) {
            smoothedPressure = pressureHpa
            lastAltitude = SensorManager.getAltitude(SensorManager.PRESSURE_STANDARD_ATMOSPHERE, smoothedPressure)
            lastSampleTimeMs = now
            return
        }

        smoothedPressure = smoothedPressure * 0.85f + pressureHpa * 0.15f
        val newAltitude = SensorManager.getAltitude(SensorManager.PRESSURE_STANDARD_ATMOSPHERE, smoothedPressure)
        val elapsedSec = ((now - lastSampleTimeMs).coerceAtLeast(1L)) / 1000f
        val delta = newAltitude - lastAltitude

        // Always advance the tracked altitude (even on rejected/negative deltas) so the
        // next real climb is measured from a fresh baseline, not a stale one.
        lastAltitude = newAltitude
        lastSampleTimeMs = now

        if (delta <= NOISE_DEADBAND_M) return // Ignore descents & noise below the deadband

        val climbRate = delta / elapsedSec
        if (climbRate > MAX_CLIMB_RATE_M_PER_S) {
            Log.d("PacePulseElevation", "Rejected implausible climb rate ${climbRate}m/s (likely elevator)")
            return
        }

        val motionState = prefs(context).getInt(NativeStepManager.KEY_MOTION_STATE, DetectedActivity.UNKNOWN)
        if (motionState != DetectedActivity.WALKING && motionState != DetectedActivity.RUNNING) {
            Log.d("PacePulseElevation", "Rejected elevation gain - user not walking (motion=$motionState)")
            return
        }

        val todayStr = getTodayStr()
        val keyDate = "elevation_date_$activeUid"
        val keyElevation = "elevation_${activeUid}_$todayStr"
        val p = prefs(context)

        val savedDate = p.getString(keyDate, "")
        val previousElevation = if (savedDate == todayStr) p.getFloat(keyElevation, 0f) else 0f

        val newElevation = previousElevation + delta
        p.edit()
            .putString(keyDate, todayStr)
            .putFloat(keyElevation, newElevation)
            .apply()

        syncTodayElevationToWebView(context, webView)
    }

    @Synchronized
    fun resetTodayElevation(context: Context) {
        val todayStr = getTodayStr()
        prefs(context).edit()
            .putString("elevation_date_$activeUid", todayStr)
            .putFloat("elevation_${activeUid}_$todayStr", 0f)
            .apply()
        lastAltitude = Float.NaN
        smoothedPressure = -1f
    }

    fun getSavedTodayElevation(context: Context): Pair<Float, Boolean> {
        val todayStr = getTodayStr()
        val p = prefs(context)
        val savedDate = p.getString("elevation_date_$activeUid", "")
        val meters = if (savedDate == todayStr) p.getFloat("elevation_${activeUid}_$todayStr", 0f) else 0f
        return Pair(meters, true)
    }

    fun syncTodayElevationToWebView(context: Context, webView: WebView?, supportedOverride: Boolean? = null) {
        if (webView == null) return
        val (meters, supported) = if (supportedOverride == false) Pair(0f, false) else getSavedTodayElevation(context)
        webView.post {
            webView.evaluateJavascript(
                "if(window.syncNativeTodayElevation){ window.syncNativeTodayElevation($meters, $supported); }", null
            )
        }
    }
}
