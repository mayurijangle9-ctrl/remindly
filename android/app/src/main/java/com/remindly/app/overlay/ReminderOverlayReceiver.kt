package com.remindly.app.overlay

import android.app.AlarmManager
import android.app.KeyguardManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import android.provider.Settings
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * BroadcastReceiver responsible for:
 * 1. Receiving scheduled AlarmManager triggers when a reminder reaches its due time.
 * 2. Evaluating whether overlay conditions are met (permission, screen unlocked, app backgrounded).
 * 3. Launching ReminderOverlayService if eligible, or falling back seamlessly to normal notifications.
 * 4. Handling actions initiated from the floating overlay (Done, Snooze) with direct SQLite persistence.
 */
class ReminderOverlayReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_TRIGGER = "com.remindly.app.ACTION_REMINDER_OVERLAY_TRIGGER"
        const val ACTION_DONE = "com.remindly.app.ACTION_OVERLAY_DONE"
        const val ACTION_SNOOZE = "com.remindly.app.ACTION_OVERLAY_SNOOZE"

        fun scheduleAlarm(
            context: Context,
            reminderId: String,
            title: String,
            body: String,
            theme: String,
            stickerKey: String,
            dueAt: String,
            triggerAtMs: Long
        ) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, ReminderOverlayReceiver::class.java).apply {
                action = ACTION_TRIGGER
                putExtra("reminderId", reminderId)
                putExtra("title", title)
                putExtra("body", body)
                putExtra("theme", theme)
                putExtra("stickerKey", stickerKey)
                putExtra("dueAt", dueAt)
            }

            val pendingIntent = PendingIntent.getBroadcast(
                context,
                reminderId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent)
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent)
                }
            } catch (_: SecurityException) {
                // If exact alarm permission is restricted, schedule standard windowed alarm
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent)
            }
        }

        fun cancelAlarm(context: Context, reminderId: String) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, ReminderOverlayReceiver::class.java).apply {
                action = ACTION_TRIGGER
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                reminderId.hashCode(),
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_TRIGGER -> handleTrigger(context, intent)
            ACTION_DONE -> handleDone(context, intent)
            ACTION_SNOOZE -> handleSnooze(context, intent)
        }
    }

    private fun handleTrigger(context: Context, intent: Intent) {
        val reminderId = intent.getStringExtra("reminderId") ?: return

        // 1. Verify overlay permission
        val hasOverlayPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }

        if (!hasOverlayPermission) {
            // Overlay permission is not granted; fallback to standard notification
            return
        }

        // 2. Check if device lock screen is active
        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        if (keyguardManager?.isKeyguardLocked == true) {
            // Lock screen is active; do not show floating overlay over secure lockscreen
            return
        }

        // 3. Check if Remindly itself is currently in foreground
        if (AppLifecycleTracker.isAppInForeground) {
            // App is already in foreground; in-app ReminderPopup handles presentation
            return
        }

        // 4. Launch floating overlay service
        val serviceIntent = Intent(context, ReminderOverlayService::class.java).apply {
            putExtras(intent)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        } catch (_: Exception) {
            // Handled gracefully; fallback notification remains active
        }
    }

    private fun handleDone(context: Context, intent: Intent) {
        val reminderId = intent.getStringExtra("reminderId") ?: return

        // Cancel any pending notification
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        notificationManager?.cancel(reminderId.hashCode())

        // Update database status to 'completed'
        updateReminderStatusInDb(context, reminderId, "completed")

        // Dispatch event to React Native if engine is active
        ReminderOverlayModule.sendEvent("onOverlayDone", reminderId)
    }

    private fun handleSnooze(context: Context, intent: Intent) {
        val reminderId = intent.getStringExtra("reminderId") ?: return
        val minutes = intent.getIntExtra("minutes", 5)

        val snoozeTimeMs = System.currentTimeMillis() + (minutes * 60 * 1000L)
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val nextDueIso = isoFormat.format(Date(snoozeTimeMs))

        // Update reminder due_at in SQLite database
        updateReminderDueAtInDb(context, reminderId, nextDueIso)

        // Reschedule the native overlay alarm
        val title = intent.getStringExtra("title") ?: "Reminder"
        val body = intent.getStringExtra("body") ?: ""
        val theme = intent.getStringExtra("theme") ?: "default"
        val stickerKey = intent.getStringExtra("stickerKey") ?: "default"

        scheduleAlarm(context, reminderId, title, body, theme, stickerKey, nextDueIso, snoozeTimeMs)

        // Dispatch event to React Native if engine is active
        ReminderOverlayModule.sendEvent("onOverlaySnooze", reminderId)
    }

    private fun updateReminderStatusInDb(context: Context, reminderId: String, status: String) {
        try {
            val dbFile = context.getDatabasePath("remindly.db")
            if (dbFile.exists()) {
                val db = SQLiteDatabase.openDatabase(dbFile.path, null, SQLiteDatabase.OPEN_READWRITE)
                val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val nowIso = isoFormat.format(Date())

                val values = ContentValues().apply {
                    put("status", status)
                    put("completed_at", nowIso)
                    put("updated_at", nowIso)
                    put("notification_ids_json", "[]")
                }
                db.update("reminders", values, "id = ?", arrayOf(reminderId))
                db.close()
            }
        } catch (_: Exception) {
            // Graceful fallback
        }
    }

    private fun updateReminderDueAtInDb(context: Context, reminderId: String, dueAtIso: String) {
        try {
            val dbFile = context.getDatabasePath("remindly.db")
            if (dbFile.exists()) {
                val db = SQLiteDatabase.openDatabase(dbFile.path, null, SQLiteDatabase.OPEN_READWRITE)
                val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val nowIso = isoFormat.format(Date())

                val values = ContentValues().apply {
                    put("due_at", dueAtIso)
                    put("updated_at", nowIso)
                }
                db.update("reminders", values, "id = ?", arrayOf(reminderId))
                db.close()
            }
        } catch (_: Exception) {
            // Graceful fallback
        }
    }
}
