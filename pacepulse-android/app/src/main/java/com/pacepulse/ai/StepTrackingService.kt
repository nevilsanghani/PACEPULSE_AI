package com.pacepulse.ai

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
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
 * PacePulse AI - 24/7 Reliable Background Step Tracking Service
 * Listens to hardware step counter continuously and opens MainActivity when notification is tapped
 */
class StepTrackingService : Service(), SensorEventListener {

    private lateinit var sensorManager: SensorManager
    private var stepCounterSensor: Sensor? = null
    private var stepDetectorSensor: Sensor? = null
    private var pressureSensor: Sensor? = null
    private lateinit var notificationManager: NotificationManager

    companion object {
        const val CHANNEL_ID = "PacePulseStepChannel"
        const val NOTIFICATION_ID = 1001
        var isServiceRunning = false
    }

    override fun onCreate() {
        super.onCreate()
        isServiceRunning = true
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createNotificationChannel()

        val initialSteps = NativeStepManager.getSavedTodaySteps(this)
        startForeground(NOTIFICATION_ID, buildNotification(initialSteps))

        // Ensure motion classification (walking vs in-vehicle) is active even when this
        // service starts on its own (e.g. after boot), independent of MainActivity.
        NativeStepManager.registerMotionTransitionUpdates(this)

        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
        pressureSensor = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE)
        val accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        stepCounterSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
        stepDetectorSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
        accelSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
        pressureSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }

        Log.d("PacePulseService", "24/7 Background Step Tracking Service Active.")
    }

    private fun buildNotification(steps: Int): Notification {
        val text = if (steps > 0) "🚶 $steps steps today" else "Smart step tracking active"

        // Intent to launch MainActivity when notification is tapped
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("PacePulse AI Step Tracker")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return

        if (event.sensor.type == Sensor.TYPE_ACCELEROMETER) {
            NativeStepManager.updateAccelerometer(event.values[0], event.values[1], event.values[2])
        } else if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
            val todaySteps = NativeStepManager.processCumulativeStep(this, event.values[0], null)
            notificationManager.notify(NOTIFICATION_ID, buildNotification(todaySteps))
        } else if (event.sensor.type == Sensor.TYPE_PRESSURE) {
            ElevationManager.processPressureSample(this, event.values[0], null)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        sensorManager.unregisterListener(this)
        Log.d("PacePulseService", "Background service destroyed.")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "PacePulse Step Tracker",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "24/7 background step tracking listener"
            }
            notificationManager.createNotificationChannel(channel)
        }
    }
}
