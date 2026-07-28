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
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * PacePulse AI - Background Step Tracking Foreground Service
 * Keeps hardware step counter active when phone screen is turned off / locked
 */
class StepTrackingService : Service(), SensorEventListener {

    private lateinit var sensorManager: SensorManager
    private var stepCounterSensor: Sensor? = null
    private var stepDetectorSensor: Sensor? = null

    companion object {
        const val CHANNEL_ID = "PacePulseStepChannel"
        const val NOTIFICATION_ID = 1001
        var backgroundStepsDelta = 0
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("PacePulse AI Step Counter Active")
            .setContentText("Tracking steps in background...")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        startForeground(NOTIFICATION_ID, notification)

        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)

        stepCounterSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
        }
        stepDetectorSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST)
        }

        Log.d("PacePulseService", "Foreground Step Tracking Service started")
    }

    private var lastCumulativeStepCount = -1f

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return

        if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
            val currentTotal = event.values[0]
            if (lastCumulativeStepCount < 0f) {
                lastCumulativeStepCount = currentTotal
            } else {
                val delta = (currentTotal - lastCumulativeStepCount).toInt()
                if (delta > 0) {
                    lastCumulativeStepCount = currentTotal
                    backgroundStepsDelta += delta
                    Log.d("PacePulseService", "Background hardware step delta: $delta (Total: $backgroundStepsDelta)")
                }
            }
        } else if (event.sensor.type == Sensor.TYPE_STEP_DETECTOR && stepCounterSensor == null) {
            val stepsDetected = event.values[0].toInt()
            backgroundStepsDelta += stepsDetected
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "PacePulse Step Tracker",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Background physical step tracking listener"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
