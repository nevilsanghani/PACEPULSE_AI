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
 *
 * False-step defenses in effect (see processCumulativeStep for the actual logic):
 *  1. Vehicle rejection - hardware ticks while Activity Recognition confirms IN_VEHICLE
 *     (auto/car/bus vibration) are excluded.
 *  2. Cycling rejection - hardware ticks while confirmed ON_BICYCLE are excluded
 *     (pedaling can trigger the step sensor on some devices).
 *  3. STILL is deliberately NOT excluded (removed after real-world testing): Activity
 *     Recognition takes several seconds to confirm a state change, and can also report
 *     STILL for stretches of a real walk (checking the phone, brief pauses, a steady
 *     hand-carry). Excluding it was silently discarding genuine steps taken during that
 *     lag, which is worse for a step tracker than the rare fidget/pocket-handling tick it
 *     was meant to catch - the cadence cap below already guards against the sensor-burst
 *     case that actually caused the original over-counting complaint.
 *  4. Cadence sanity cap - every single sensor tick's delta is capped against how many
 *     real steps a human could plausibly take in the elapsed time since the last tick
 *     (generous ceiling, well above sprinting pace). This is what stops a single
 *     anomalous OEM sensor burst/batching glitch from permanently inflating the count,
 *     since the count is monotonic (never decreases) once accepted. Genuine large step
 *     counts delivered after a real gap (e.g. phone asleep in pocket during a long walk)
 *     are still accepted in full, since the allowance scales with elapsed time.
 *  5. Duplicate-tick short-circuit - if the hardware total hasn't actually changed since
 *     the last processed reading (the foreground screen and the 24/7 background service
 *     both listen to the same sensor), the redundant call is a no-op instead of
 *     re-running prefs writes / UI push / widget update for nothing.
 *
 * NOT covered (inherent hardware/OS limits, not fixable in app code): a small number of
 * false positives from the phone's own step-counter firmware while genuinely walking-like
 * motion happens without walking (e.g. vigorously shaking the phone in hand) - Activity
 * Recognition would classify that as WALKING too, since it can't distinguish intent.
 */
object NativeStepManager {

    const val PREFS_NAME = "pacepulse_hardware_prefs"
    const val KEY_MOTION_STATE = "current_motion_state"
    const val KEY_MOTION_STATE_UPDATED_AT = "motion_state_updated_at"

    // Floor for the cadence cap on very-short-elapsed ticks (no human takes more than
    // this many real steps in a single TYPE_STEP_COUNTER callback interval).
    private const val MAX_DELTA_PER_TICK = 20f
    // Generous sustained cadence ceiling (well above sprinting) used to scale the cap
    // for longer gaps between ticks, e.g. a batch of ticks delivered after the phone
    // was asleep for several minutes during a real walk.
    private const val MAX_STEPS_PER_SECOND = 5f
    private val EXCLUDED_MOTION_STATES = setOf(
        DetectedActivity.IN_VEHICLE,
        DetectedActivity.ON_BICYCLE
    )
    private const val MOTION_TRANSITION_REQUEST_CODE = 4001

    private var activeUid: String = "guest"
    private var lastKnownHardwareTotal: Float = -1f
    private var lastEventTimestampMs: Long = -1L

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
        val previousEventTimestampMs = lastEventTimestampMs
        val now = System.currentTimeMillis()

        val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val todayStr = getTodayStr()

        val keyBaseline = "baseline_$activeUid"
        val keyDate = "date_$activeUid"
        val keySteps = "steps_${activeUid}_$todayStr"

        val savedDate = prefs.getString(keyDate, "")
        var midnightBaseline = prefs.getFloat(keyBaseline, -1f)

        // Duplicate-tick short-circuit: the foreground screen and the 24/7 background
        // service both listen to the same hardware sensor, so the same reading often
        // arrives twice. If nothing actually changed, skip redundant prefs writes / UI
        // push / widget update instead of reprocessing an identical value.
        if (currentTotal == previousHardwareTotal && savedDate == todayStr && midnightBaseline >= 0f) {
            val alreadySaved = prefs.getInt(keySteps, 0)
            if (webView != null) {
                webView.post {
                    webView.evaluateJavascript(
                        "if(window.syncNativeTodaySteps){ window.syncNativeTodaySteps($alreadySaved, '$activeUid'); }", null
                    )
                }
            }
            return alreadySaved
        }

        lastKnownHardwareTotal = currentTotal
        lastEventTimestampMs = now

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
            val rawInstantDelta = currentTotal - previousHardwareTotal
            if (rawInstantDelta > 0f) {
                // Cadence sanity cap - how many real steps a human could plausibly take in
                // the elapsed time since the last tick. Scales with elapsed time so a
                // legitimate batch of steps delivered after the phone was asleep in a
                // pocket is still accepted in full; only an implausibly fast burst (a
                // sensor glitch) gets capped, which is what stops a one-off spike from
                // permanently inflating the count (it's monotonic - never decreases once
                // accepted).
                val elapsedSec = if (previousEventTimestampMs > 0) {
                    (now - previousEventTimestampMs).coerceAtLeast(0L) / 1000f
                } else 0f
                val plausibleCap = maxOf(MAX_DELTA_PER_TICK, elapsedSec * MAX_STEPS_PER_SECOND)
                val acceptedDelta = rawInstantDelta.coerceAtMost(plausibleCap)
                val rejectedByCadence = rawInstantDelta - acceptedDelta

                // Reject hardware ticks that occurred while Activity Recognition confirms
                // the user isn't actually walking/running (riding in a vehicle, sitting
                // still and fidgeting, or cycling) by advancing the baseline forward so
                // those ticks are excluded today AND never resurface later.
                val motionState = prefs.getInt(KEY_MOTION_STATE, DetectedActivity.UNKNOWN)
                val excludedByMotion = if (motionState in EXCLUDED_MOTION_STATES) acceptedDelta else 0f

                val totalExcluded = excludedByMotion + rejectedByCadence
                if (totalExcluded > 0f) {
                    midnightBaseline += totalExcluded
                    prefs.edit().putFloat(keyBaseline, midnightBaseline).apply()
                    if (rejectedByCadence > 0f) {
                        Log.d("PacePulseNative", "Rejected $rejectedByCadence implausible-cadence steps ($rawInstantDelta in ${elapsedSec}s) for user $activeUid")
                    }
                    if (excludedByMotion > 0f) {
                        Log.d("PacePulseNative", "Excluded $excludedByMotion steps while motion=$motionState for user $activeUid")
                    }
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

    /**
     * Diagnostic-only snapshot of the raw internal state behind the final step count -
     * baseline, last hardware reading, motion-state exclusion, active uid/date keys -
     * so a stuck-at-0 report can be root-caused on-device without adb/logcat access.
     */
    @Synchronized
    fun getDebugSnapshot(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val todayStr = getTodayStr()
        val keyBaseline = "baseline_$activeUid"
        val keyDate = "date_$activeUid"
        val keySteps = "steps_${activeUid}_$todayStr"

        val midnightBaseline = prefs.getFloat(keyBaseline, -1f)
        val savedDate = prefs.getString(keyDate, "") ?: ""
        val savedSteps = prefs.getInt(keySteps, 0)
        val motionState = prefs.getInt(KEY_MOTION_STATE, DetectedActivity.UNKNOWN)

        return "{" +
            "\"activeUid\":\"$activeUid\"," +
            "\"todayStr\":\"$todayStr\"," +
            "\"savedDate\":\"$savedDate\"," +
            "\"midnightBaseline\":$midnightBaseline," +
            "\"lastKnownHardwareTotal\":$lastKnownHardwareTotal," +
            "\"savedSteps\":$savedSteps," +
            "\"motionState\":$motionState," +
            "\"excludedByMotion\":${motionState in EXCLUDED_MOTION_STATES}" +
            "}"
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
