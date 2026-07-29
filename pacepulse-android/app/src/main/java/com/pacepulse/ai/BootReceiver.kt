package com.pacepulse.ai

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * PacePulse AI - Phone Boot & Restart Receiver
 * Auto-starts 24/7 background step tracking service on device startup
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            Log.d("PacePulseBoot", "Phone booted up! Launching PacePulse AI 24/7 background step service.")
            try {
                val serviceIntent = Intent(context, StepTrackingService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            } catch (e: Exception) {
                Log.e("PacePulseBoot", "Failed to autostart service on boot: ${e.message}")
            }
        }
    }
}
