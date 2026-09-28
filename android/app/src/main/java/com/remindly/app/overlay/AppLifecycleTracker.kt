package com.remindly.app.overlay

import android.app.Activity
import android.app.Application
import android.os.Bundle

/**
 * Tracks whether the Remindly React Native Activity is currently visible and active in the foreground.
 * When the app is in the foreground, Remindly displays its in-app ReminderPopup.
 * When the app is not in the foreground (e.g. user is in YouTube, Chrome, or home screen),
 * the native floating overlay is used.
 */
object AppLifecycleTracker : Application.ActivityLifecycleCallbacks {
    @Volatile
    var isAppInForeground: Boolean = false
        private set

    private var resumedCount = 0

    override fun onActivityResumed(activity: Activity) {
        resumedCount++
        isAppInForeground = resumedCount > 0
    }

    override fun onActivityPaused(activity: Activity) {
        resumedCount = maxOf(0, resumedCount - 1)
        isAppInForeground = resumedCount > 0
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
    override fun onActivityStarted(activity: Activity) {}
    override fun onActivityStopped(activity: Activity) {}
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
    override fun onActivityDestroyed(activity: Activity) {}
}
