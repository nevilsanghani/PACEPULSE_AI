package com.pacepulse.ai

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.widget.RemoteViews

/**
 * PacePulse AI - Premium Wide Android Home Screen AppWidget (>50% Screen Width)
 * Supports Solid Cyber Dark vs Glass Transparent Background Styles
 */
class PacePulseWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        private const val WIDGET_PREFS = "pacepulse_widget_prefs"
        private const val KEY_WIDGET_STYLE = "widget_style" // "solid" or "transparent"

        fun getWidgetStyle(context: Context): String {
            val prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
            return prefs.getString(KEY_WIDGET_STYLE, "solid") ?: "solid"
        }

        fun setWidgetStyle(context: Context, style: String) {
            val prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_WIDGET_STYLE, style).apply()
            updateAllWidgets(context)
        }

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val steps = NativeStepManager.getSavedTodaySteps(context)
            val style = getWidgetStyle(context)

            val activeKcal = Math.round(steps * 0.04f)
            val distKm = Math.round((steps * 0.72f) / 10f) / 100f

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val bgDrawable = if (style == "transparent") {
                R.drawable.widget_background_transparent
            } else {
                R.drawable.widget_background_solid
            }

            val views = RemoteViews(context.packageName, R.layout.pace_pulse_widget).apply {
                setInt(R.id.widget_root, "setBackgroundResource", bgDrawable)
                setTextViewText(R.id.widget_steps, "🚶 ${String.format("%,d", steps)}")
                setTextViewText(R.id.widget_calories, "🔥 $activeKcal kcal")
                setTextViewText(R.id.widget_distance, "📍 $distKm km")
                
                setOnClickPendingIntent(R.id.widget_root, pendingIntent)
                setOnClickPendingIntent(R.id.widget_title, pendingIntent)
                setOnClickPendingIntent(R.id.widget_steps, pendingIntent)
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, PacePulseWidget::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (id in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, id)
            }
        }
    }
}
