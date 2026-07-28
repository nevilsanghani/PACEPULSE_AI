import React, { useState } from 'react';
import { X, Smartphone, Code2, Copy, Check, ShieldCheck, Cpu } from 'lucide-react';

export function NativeAndroidGuideModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('sensorService');
  const [copiedTab, setCopiedTab] = useState('');

  const codeSnippets = {
    sensorService: `// Native Android Kotlin Foreground Step Sensor Service
// Package: com.pacepulse.ai.service.ForegroundStepService.kt

package com.pacepulse.ai.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.IBinder
import androidx.core.app.NotificationCompat

class ForegroundStepService : Service(), SensorEventListener {

    private lateinit var sensorManager: SensorManager
    private var stepSensor: Sensor? = null
    private var initialStepCount = -1f
    private var currentDailySteps = 0

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

        stepSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
        }

        startForeground(1001, createNotification(0))
    }

    override fun onSensorChanged(event: SensorEvent?) {
        event?.let {
            if (it.sensor.type == Sensor.TYPE_STEP_COUNTER) {
                val totalHardwareSteps = it.values[0]
                if (initialStepCount < 0) {
                    initialStepCount = totalHardwareSteps
                }
                currentDailySteps = (totalHardwareSteps - initialStepCount).toInt()
                
                // Broadcast updated steps to Jetpack Compose UI & Room DB
                val intent = Intent("com.pacepulse.ai.STEP_UPDATE").apply {
                    putExtra("DAILY_STEPS", currentDailySteps)
                }
                sendBroadcast(intent)
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotification(steps: Int): Notification {
        val channelId = "step_tracker_channel"
        val channel = NotificationChannel(channelId, "PacePulse Step Tracker", NotificationManager.IMPORTANCE_LOW)
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)

        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("PacePulse AI Active")
            .setContentText("Step Count: $steps steps walking today")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .build()
    }
}`,

    calorieEngine: `// Precision MET & Calorie Engine in Kotlin
// Package: com.pacepulse.ai.engine.CalorieEngine.kt

package com.pacepulse.ai.engine

data class UserProfile(
    val gender: String = "male",
    val age: Int = 26,
    val weightKg: Double = 70.0,
    val heightCm: Double = 175.0,
    val dailyGoal: Int = 10000
)

object CalorieEngine {

    fun getStrideCm(heightCm: Double, gender: String): Double {
        return when (gender.lowercase()) {
            "female" -> heightCm * 0.413
            else -> heightCm * 0.415
        }
    }

    fun calculateDistanceKm(steps: Int, heightCm: Double, gender: String): Double {
        val strideMeters = getStrideCm(heightCm, gender) / 100.0
        return Math.round((steps * strideMeters / 1000.0) * 100.0) / 100.0
    }

    fun calculateCalories(steps: Int, profile: UserProfile, activeMinutes: Double = steps / 100.0): Double {
        if (steps <= 0) return 0.0
        
        // MET based on walking cadence (~100 spm = 3.5 MET)
        val met = 3.5 
        val hours = activeMinutes / 60.0
        val activeKcal = met * profile.weightKg * hours
        
        // BMR Resting Energy
        val bmrBase = (10 * profile.weightKg) + (6.25 * profile.heightCm) - (5 * profile.age)
        val bmrDaily = if (profile.gender == "female") bmrBase - 161 else bmrBase + 5
        val restingKcal = (bmrDaily / 24.0) * hours
        
        return Math.round(activeKcal + restingKcal)
    }
}`,

    socialSharing: `// WhatsApp & Instagram Share Helper for Android Kotlin
// Package: com.pacepulse.ai.util.SocialShareHelper.kt

package com.pacepulse.ai.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File

object SocialShareHelper {

    fun shareToWhatsApp(context: Context, quoteText: String, steps: Int, goal: Int) {
        val message = "🏃 PacePulse AI Step Milestone 🏃\\n\\n$quoteText\\n\\nSteps Walked: $steps / $goal Goal! 🔥"
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, message)
            setPackage("com.whatsapp")
        }
        try {
            context.startActivity(intent)
        } catch (e: Exception) {
            // Fallback to chooser if WhatsApp not installed
            context.startActivity(Intent.createChooser(intent, "Share Goal via"))
        }
    }

    fun shareCardToInstagram(context: Context, imageFile: File) {
        val uri: Uri = FileProvider.getUriForFile(context, "\${context.packageName}.fileprovider", imageFile)
        val intent = Intent("com.instagram.share.ADD_TO_STORY").apply {
            setDataAndType(uri, "image/*")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            setPackage("com.instagram.android")
        }
        try {
            context.startActivity(intent)
        } catch (e: Exception) {
            context.startActivity(Intent.createChooser(intent, "Share Story via"))
        }
    }
}`
  };

  const copyToClipboard = (text, tabKey) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabKey);
    setTimeout(() => setCopiedTab(''), 2000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(4, 9, 20, 0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '820px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '32px',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={22} />
        </button>

        {/* Title Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(0, 242, 254, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(0, 242, 254, 0.3)'
          }}>
            <Smartphone size={22} color="#00F2FE" />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Native Android Kotlin Architecture</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Hardware Step Sensor, Background Service & Social Intent Code
            </p>
          </div>
        </div>

        {/* Code Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
          <button
            className="btn-secondary"
            onClick={() => setActiveTab('sensorService')}
            style={{
              borderColor: activeTab === 'sensorService' ? '#00F2FE' : 'transparent',
              color: activeTab === 'sensorService' ? '#00F2FE' : 'var(--text-muted)'
            }}
          >
            <Cpu size={16} /> Sensor Service (24/7)
          </button>

          <button
            className="btn-secondary"
            onClick={() => setActiveTab('calorieEngine')}
            style={{
              borderColor: activeTab === 'calorieEngine' ? '#00F2FE' : 'transparent',
              color: activeTab === 'calorieEngine' ? '#00F2FE' : 'var(--text-muted)'
            }}
          >
            <Code2 size={16} /> MET Calorie Engine
          </button>

          <button
            className="btn-secondary"
            onClick={() => setActiveTab('socialSharing')}
            style={{
              borderColor: activeTab === 'socialSharing' ? '#00F2FE' : 'transparent',
              color: activeTab === 'socialSharing' ? '#00F2FE' : 'var(--text-muted)'
            }}
          >
            <ShieldCheck size={16} /> Social Share Intents
          </button>
        </div>

        {/* Code Content Container */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => copyToClipboard(codeSnippets[activeTab], activeTab)}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {copiedTab === activeTab ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
            {copiedTab === activeTab ? 'Copied!' : 'Copy Code'}
          </button>

          <pre style={{
            background: '#040711',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            color: '#E2E8F0',
            fontSize: '13px',
            fontFamily: 'Consolas, Monaco, monospace',
            overflowX: 'auto',
            lineHeight: 1.5
          }}>
            {codeSnippets[activeTab]}
          </pre>
        </div>
      </div>
    </div>
  );
}
