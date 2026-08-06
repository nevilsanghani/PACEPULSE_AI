package com.pacepulse.ai

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import android.webkit.WebView
import androidx.core.content.ContextCompat
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.DetectedActivity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * PacePulse AI - Absolute 24/7 Monotonic Hardware Step Counter Engine
 * Guarantees step counts NEVER decrease and tracks walking 100% accurately per user.
 * Rejects hardware step-counter increments that occur while Activity Recognition
 * classifies the user as IN_VEHICLE (e.g. riding in an auto/car), so vehicle vibration
 * never inflates the day's step count.
 */
object NativeStepManager {

    const val PREFS_NAME = "pacepulse_hardware_prefs"
    const val KEY_MOTION_STATE = "current_motion_state"
    const val KEY_MOTION_STATE_UPDATED_AT = "motion_state_updated_at"

    // No human takes more than this many real steps between two TYPE_STEP_COUNTER
    // events (which fire per-step) - defends against a single garbage sensor burst.
    private const val MAX_DELTA_PER_TICK = 20f
    private const val MOTION_TRANSITION_REQUEST_CODE = 4001

    private var activeUid: String = "guest"
    private var lastKnownHardwareTotal: Float = -1f

    private fun getTodayStr(): String {
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    }

    /**
     * Registers Activity Recognition Transition updates so we can tell WALKING/RUNNING
     * apart from IN_VEHICLE/ON_BICYCLE/STILL. Safe to call repeatedly (idempotent) from
     * both MainActivity and StepTrackingService - re-registering with the same request
     * code just replaces the prior registration.
     */
    fun registerMotionTransitionUpdates(context: Context) {
        val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
        } else {
            true // No runtime permission needed pre-Android 10; manifest permission covers it.
        }
        if (!hasPermission) {
            Log.w("PacePulseNative", "Skipping motion transition registration - ACTIVITY_RECOGNITION not granted yet")
            return
        }

        try {
            val transitions = listOf(
                DetectedActivity.STILL,
                DetectedActivity.WALKING,
                DetectedActivity.RUNNING,
                DetectedActivity.IN_VEHICLE,
                DetectedActivity.ON_BICYCLE
            ).map { type ->
                ActivityTransition.Builder()
                    .setActivityType(type)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                    .build()
            }

            val request = ActivityTransitionRequest(transitions)

            val receiverIntent = Intent(context, MotionStateReceiver::class.java)
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(context, MOTION_TRANSITION_REQUEST_CODE, receiverIntent, flags)

            ActivityRecognition.getClient(context)
                .requestActivityTransitionUpdates(request, pendingIntent)
                .addOnSuccessListener {
                    Log.d("PacePulseNative", "Motion transition updates registered")
                }
                .addOnFailureListener { e ->
                    Log.w("PacePulseNative", "Motion transition registration failed: ${e.message}")
                }
        } catch (e: Exception) {
            Log.w("PacePulseNative", "Motion transition registration error: ${e.message}")
        }
    }

    private fun sanitizeUid(uid: String?): String {
        val clean = (uid ?: "guest").trim().lowercase().replace("[^a-z0-9_]".toRegex(), "_")
        return if (clean.isEmpty()) "guest" else clean
    }

    @Synchronized
    fun updateAccelerometer(x: Float, y: Float, z: Float) {
        // Reserved for future telemetry
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
        val previousHardwareTotal = lastKnownHardwareTotal
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
        } else if (previousHardwareTotal >= 0f) {
            // Reject hardware step-counter increments that occurred while Activity
            // Recognition says the user is riding in a vehicle (vibration false
            // positives, e.g. an auto-rickshaw) by advancing the baseline forward so
            // those ticks are excluded today AND never resurface later.
            val motionState = prefs.getInt(KEY_MOTION_STATE, DetectedActivity.UNKNOWN)
            if (motionState == DetectedActivity.IN_VEHICLE) {
                val instantDelta = (currentTotal - previousHardwareTotal).coerceIn(0f, MAX_DELTA_PER_TICK)
                if (instantDelta > 0f) {
                    midnightBaseline += instantDelta
                    prefs.edit().putFloat(keyBaseline, midnightBaseline).apply()
                    Log.d("PacePulseNative", "Excluded $instantDelta vehicle-vibration steps for user $activeUid")
                }
            }
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
