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
 * Displays ONLY:
 * 1) Number of Steps
 * 2) Calories Burnt
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
    fun updateSingleWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        layoutResId: Int
    ) {
        val steps = NativeStepManager.getSavedTodaySteps(context)
        val activeKcal = Math.round(steps * 0.04f)

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

            setOnClickPendingIntent(R.id.widget_root, pendingIntent)
            setOnClickPendingIntent(R.id.widget_steps, pendingIntent)
            setOnClickPendingIntent(R.id.widget_calories, pendingIntent)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    fun updateAllWidgets(context: Context) {
        val appWidgetManager = AppWidgetManager.getInstance(context)

        // Update Solid 2x2 Widgets
        val solidComp = ComponentName(context, PacePulseSolidWidget::class.java)
        for (id in appWidgetManager.getAppWidgetIds(solidComp)) {
            updateSingleWidget(context, appWidgetManager, id, R.layout.pace_pulse_widget_solid)
        }

        // Update Glass 2x2 Widgets
        val glassComp = ComponentName(context, PacePulseGlassWidget::class.java)
        for (id in appWidgetManager.getAppWidgetIds(glassComp)) {
            updateSingleWidget(context, appWidgetManager, id, R.layout.pace_pulse_widget_glass)
        }
    }
}

typealias PacePulseWidget = PacePulseWidgetHelper
