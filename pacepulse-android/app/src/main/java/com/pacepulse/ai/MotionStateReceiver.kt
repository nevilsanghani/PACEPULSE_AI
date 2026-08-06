package com.pacepulse.ai

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult

/**
 * PacePulse AI - Motion State Receiver
 * Receives Activity Recognition transition updates (WALKING/RUNNING/STILL/IN_VEHICLE/ON_BICYCLE)
 * and persists the latest state so NativeStepManager & ElevationManager can gate
 * hardware sensor readings against real user motion (rejects vehicle vibration & elevator rides).
 */
class MotionStateReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (!ActivityTransitionResult.hasResult(intent)) return
        val result = ActivityTransitionResult.extractResult(intent) ?: return

        // Only act on ENTER events; take the most recent one in this batch.
        val enterEvent = result.transitionEvents
            .filter { it.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER }
            .maxByOrNull { it.elapsedRealTimeNanos } ?: return

        val prefs = context.getSharedPreferences(NativeStepManager.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putInt(NativeStepManager.KEY_MOTION_STATE, enterEvent.activityType)
            .putLong(NativeStepManager.KEY_MOTION_STATE_UPDATED_AT, System.currentTimeMillis())
            .apply()

        Log.d("PacePulseMotion", "Motion state entered: ${enterEvent.activityType}")
    }
}
