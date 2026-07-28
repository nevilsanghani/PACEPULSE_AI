package com.pacepulse.ai

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.hardware.TriggerEvent
import android.hardware.TriggerEventListener
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * PacePulse AI - Battery Smart Background Step Tracking Service
 * Auto-starts on motion and auto-stops after 2 minutes of phone idling to prevent battery drain.
 */
class StepTrackingService : Service(), SensorEventListener {

    private lateinit var sensorManager: SensorManager
    private var stepCounterSensor: Sensor? = null
    private var stepDetectorSensor: Sensor? = null
    private var sigMotionSensor: Sensor? = null

    private val idleHandler = Handler(Looper.getMainLooper())
    private val IDLE_TIMEOUT_MS = 2 * 60 * 1000L // 2 Minutes Idle Timeout

    private val idleRunnable = Runnable {
        Log.d("PacePulseBattery", "Phone idle for 2 minutes. Auto-stopping background service to save battery.")
        stopSelf()
    }

    companion object {
        const val CHANNEL_ID = "PacePulseStepChannel"
        const val NOTIFICATION_ID = 1001
        var backgroundStepsDelta = 0
        var isServiceRunning = false
    }

    override fun onCreate() {
        super.onCreate()
        isServiceRunning = true
        createNotificationChannel()

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("PacePulse AI Step Tracker")
            .setContentText("Smart motion step tracking active")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        startForeground(NOTIFICATION_ID, notification)

        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
        sigMotionSensor = sensorManager.getDefaultSensor(Sensor.TYPE_SIGNIFICANT_MOTION)

        stepCounterSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
        }
        stepDetectorSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
        }

        // Reset 2-minute idle timer on start
        resetIdleTimer()
        Log.d("PacePulseService", "Battery-Smart Motion Step Tracking Service Started.")
    }

    private fun resetIdleTimer() {
        idleHandler.removeCallbacks(idleRunnable)
        idleHandler.postDelayed(idleRunnable, IDLE_TIMEOUT_MS)
    }

    private var lastCumulativeStepCount = -1f

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return

        // Step detected -> Phone is active, reset 2-minute idle countdown
        resetIdleTimer()

        if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
            val currentTotal = event.values[0]
            if (lastCumulativeStepCount < 0f) {
                lastCumulativeStepCount = currentTotal
            } else {
                val delta = (currentTotal - lastCumulativeStepCount).toInt()
                if (delta > 0) {
                    lastCumulativeStepCount = currentTotal
                    backgroundStepsDelta += delta
                    Log.d("PacePulseService", "Background step delta: $delta (Total: $backgroundStepsDelta)")
                }
            }
        } else if (event.sensor.type == Sensor.TYPE_STEP_DETECTOR && stepCounterSensor == null) {
            val stepsDetected = event.values[0].toInt()
            backgroundStepsDelta += stepsDetected
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        resetIdleTimer()
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        idleHandler.removeCallbacks(idleRunnable)
        sensorManager.unregisterListener(this)
        Log.d("PacePulseService", "Background service stopped. Battery preserved.")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "PacePulse Step Tracker",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Smart motion step tracking listener"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
