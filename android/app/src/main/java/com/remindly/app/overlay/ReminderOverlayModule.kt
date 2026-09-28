package com.remindly.app.overlay

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference

/**
 * React Native bridge module exposing Android overlay capabilities and alarm scheduling.
 */
class ReminderOverlayModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ReminderOverlay"
        private var reactContextRef: WeakReference<ReactApplicationContext>? = null

        fun sendEvent(eventName: String, reminderId: String) {
            val context = reactContextRef?.get() ?: return
            try {
                if (context.hasActiveReactInstance()) {
                    val params = Arguments.createMap().apply {
                        putString("reminderId", reminderId)
                    }
                    context
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit(eventName, params)
                }
            } catch (_: Exception) {
                // Safely ignored if React context is detaching
            }
        }
    }

    init {
        reactContextRef = WeakReference(reactContext)
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openOverlaySettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${reactApplicationContext.packageName}")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.resolve(true)
            }
        } catch (_: Exception) {
            // Some OEM ROMs fail with package URI; fallback to generic overlay settings screen
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val fallbackIntent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactApplicationContext.startActivity(fallbackIntent)
                    promise.resolve(true)
                } else {
                    promise.resolve(true)
                }
            } catch (fallbackError: Exception) {
                promise.reject("OVERLAY_SETTINGS_ERROR", fallbackError.message)
            }
        }
    }

    @ReactMethod
    fun scheduleOverlay(
        reminderId: String,
        title: String,
        body: String,
        theme: String,
        stickerKey: String,
        dueAtIso: String,
        triggerAtMs: Double,
        promise: Promise
    ) {
        try {
            ReminderOverlayReceiver.scheduleAlarm(
                context = reactApplicationContext,
                reminderId = reminderId,
                title = title,
                body = body,
                theme = theme,
                stickerKey = stickerKey,
                dueAt = dueAtIso,
                triggerAtMs = triggerAtMs.toLong()
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_OVERLAY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun cancelOverlay(reminderId: String, promise: Promise) {
        try {
            ReminderOverlayReceiver.cancelAlarm(reactApplicationContext, reminderId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_OVERLAY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun showReminder(
        reminderId: String,
        title: String,
        body: String,
        theme: String,
        stickerKey: String,
        promise: Promise
    ) {
        try {
            val intent = Intent(reactApplicationContext, ReminderOverlayService::class.java).apply {
                putExtra("reminderId", reminderId)
                putExtra("title", title)
                putExtra("body", body)
                putExtra("theme", theme)
                putExtra("stickerKey", stickerKey)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SHOW_OVERLAY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun dismissReminder(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, ReminderOverlayService::class.java)
            reactApplicationContext.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DISMISS_OVERLAY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for React Native event emitter interface
    }

    @ReactMethod
    fun removeListeners(count: Double) {
        // Keep: Required for React Native event emitter interface
    }
}
