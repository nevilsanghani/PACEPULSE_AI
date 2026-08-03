package com.pacepulse.ai

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * PacePulse AI - 2 Compact Native Android 2x2 Home Screen Widgets
 * Displays 100% Synced Steps, Calories, and Distance from App UI
 */

class PacePulseSolidWidget : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            PacePulseWidgetHelper.updateSingleWidget(context, appWidgetManager, id, R.layout.pace_pulse_widget_solid)
        }
    }
}

class PacePulseGlassWidget : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            PacePulseWidgetHelper.updateSingleWidget(context, appWidgetManager, id, R.layout.pace_pulse_widget_glass)
        }
    }
}

object PacePulseWidgetHelper {
    private const val PREFS_NAME = "pacepulse_widget_prefs"

    fun updateWidgetMetrics(context: Context, steps: Int, goal: Int, activeKcal: Int, distanceKm: Double) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putInt("synced_steps", steps)
            .putInt("synced_goal", goal)
            .putInt("synced_kcal", activeKcal)
            .putFloat("synced_dist", distanceKm.toFloat())
            .apply()

        updateAllWidgets(context)
    }

    fun updateSingleWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        layoutResId: Int
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val steps = prefs.getInt("synced_steps", NativeStepManager.getSavedTodaySteps(context))
        val activeKcal = prefs.getInt("synced_kcal", Math.round(steps * 0.04f))
        val distanceKm = prefs.getFloat("synced_dist", Math.round((steps * 0.72f) / 10f) / 100f)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val views = RemoteViews(context.packageName, layoutResId).apply {
            setTextViewText(R.id.widget_steps, "🚶 ${String.format("%,d", steps)}")
            setTextViewText(R.id.widget_calories, "🔥 $activeKcal kcal")
            setTextViewText(R.id.widget_distance, "📍 ${String.format("%.2f", distanceKm)} km")

            setOnClickPendingIntent(R.id.widget_root, pendingIntent)
            setOnClickPendingIntent(R.id.widget_steps, pendingIntent)
            setOnClickPendingIntent(R.id.widget_calories, pendingIntent)
            setOnClickPendingIntent(R.id.widget_distance, pendingIntent)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    fun updateAllWidgets(context: Context) {
        val appWidgetManager = AppWidgetManager.getInstance(context)

        // Update Solid 2x2 Widgets
        val solidComp = ComponentName(context, PacePulseSolidWidget::class.java)
        val solidIds = appWidgetManager.getAppWidgetIds(solidComp)
        for (id in solidIds) {
            updateSingleWidget(context, appWidgetManager, id, R.layout.pace_pulse_widget_solid)
        }
        if (solidIds.isNotEmpty()) {
            appWidgetManager.notifyAppWidgetViewDataChanged(solidIds, R.id.widget_root)
        }

        // Update Glass 2x2 Widgets
        val glassComp = ComponentName(context, PacePulseGlassWidget::class.java)
        val glassIds = appWidgetManager.getAppWidgetIds(glassComp)
        for (id in glassIds) {
            updateSingleWidget(context, appWidgetManager, id, R.layout.pace_pulse_widget_glass)
        }
        if (glassIds.isNotEmpty()) {
            appWidgetManager.notifyAppWidgetViewDataChanged(glassIds, R.id.widget_root)
        }
    }
}

typealias PacePulseWidget = PacePulseWidgetHelper
