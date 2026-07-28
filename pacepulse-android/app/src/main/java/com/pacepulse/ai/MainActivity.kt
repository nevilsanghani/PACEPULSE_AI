package com.pacepulse.ai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

/**
 * PacePulse AI - Native Android Application (Jetpack Compose)
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            PacePulseApp()
        }
    }
}

@Composable
fun PacePulseApp() {
    var steps by remember { mutableStateOf(6850) }
    var dailyGoal by remember { mutableStateOf(10000) }
    var age by remember { mutableStateOf(26) }
    var heightCm by remember { mutableStateOf(175f) }
    var weightKg by remember { mutableStateOf(70f) }
    var gender by remember { mutableStateOf("male") }

    // Compute live BMR & Calorie Burn
    val bmr = FitnessEngine.calculateBMR(weightKg, heightCm, age, gender)
    val distanceKm = FitnessEngine.calculateDistanceKm(steps, heightCm, gender)
    val totalCalories = FitnessEngine.calculateTotalCalories(steps, weightKg, heightCm, age, gender)

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color(0xFF040914)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // App Header Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "PacePulse AI",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF00F2FE)
                )
                Text(
                    text = "🔥 7-Day Streak",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFFF59E0B)
                )
            }

            // Step Progress Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "$steps",
                        fontSize = 48.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White
                    )
                    Text(
                        text = "/ $dailyGoal Target Steps",
                        fontSize = 14.sp,
                        color = Color(0xFF94A3B8)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    LinearProgressIndicator(
                        progress = (steps.toFloat() / dailyGoal.toFloat()).coerceIn(0f, 1f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(12.dp),
                        color = Color(0xFF00F2FE),
                        trackColor = Color(0xFF1E293B)
                    )
                }
            }

            // Real-time BMR & Fitness Metrics Grid
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                MetricCard(
                    title = "Estimated BMR",
                    value = "${bmr.roundToInt()} kcal",
                    subtitle = "Resting Metabolism",
                    modifier = Modifier.weight(1f),
                    color = Color(0xFFFCD34D)
                )
                MetricCard(
                    title = "Total Burned",
                    value = "$totalCalories kcal",
                    subtitle = "Active + BMR",
                    modifier = Modifier.weight(1f),
                    color = Color(0xFFFF6B00)
                )
                MetricCard(
                    title = "Distance",
                    value = "$distanceKm km",
                    subtitle = "Walked today",
                    modifier = Modifier.weight(1f),
                    color = Color(0xFF38BDF8)
                )
            }

            // Action Buttons
            Button(
                onClick = { steps += 500 },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00F2FE))
            ) {
                Text(text = "+ 500 Steps Walked", color = Color(0xFF040914), fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun MetricCard(title: String, value: String, subtitle: String, modifier: Modifier = Modifier, color: Color) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(text = title, fontSize = 11.sp, color = Color(0xFF94A3B8))
            Text(text = value, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = color)
            Text(text = subtitle, fontSize = 9.sp, color = Color(0xFF64748B))
        }
    }
}

/**
 * High-Precision Fitness Engine (Kotlin Native)
 */
object FitnessEngine {
    fun calculateBMR(weightKg: Float, heightCm: Float, age: Int, gender: String): Float {
        val base = 10 * weightKg + 6.25f * heightCm - 5 * age
        return if (gender == "female") base - 161f else base + 5f
    }

    fun calculateStrideCm(heightCm: Float, gender: String): Float {
        return if (gender == "female") heightCm * 0.413f else heightCm * 0.415f
    }

    fun calculateDistanceKm(steps: Int, heightCm: Float, gender: String): Float {
        val strideMeters = calculateStrideCm(heightCm, gender) / 100f
        val km = (steps * strideMeters) / 1000f
        return (km * 100).roundToInt() / 100f
    }

    fun calculateTotalCalories(steps: Int, weightKg: Float, heightCm: Float, age: Int, gender: String): Int {
        val bmrDaily = calculateBMR(weightKg, heightCm, age, gender)
        val activeHours = (steps / 100f) / 60f
        val met = 3.5f // Moderate brisk walk MET
        val activeKcal = met * weightKg * activeHours
        val restingKcal = (bmrDaily / 24f) * activeHours
        return (activeKcal + restingKcal).roundToInt()
    }
}
