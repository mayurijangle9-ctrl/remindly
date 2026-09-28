package com.remindly.app.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import com.remindly.app.R
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Transient foreground service that presents a floating reminder card
 * using WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY over other apps.
 *
 * Adheres strictly to Android lifecycle guidelines:
 * 1. Transient: stops itself immediately once an action (Done, Snooze, Close) is taken.
 * 2. Self-dismissing: 3-minute timeout prevents orphaned overlays.
 * 3. Idempotent: atomic action flag prevents duplicate DB updates or double-taps.
 * 4. Zero memory leaks: removes view from WindowManager and clears all references.
 */
class ReminderOverlayService : Service() {

    companion object {
        private const val CHANNEL_ID = "remindly_floating_reminder_channel"
        private const val NOTIFICATION_ID = 9182
        private const val AUTO_DISMISS_TIMEOUT_MS = 180000L // 3 minutes
    }

    private var windowManager: WindowManager? = null
    private var overlayContainer: FrameLayout? = null
    private var cardView: LinearLayout? = null
    private val isActionTaken = AtomicBoolean(false)
    private val mainHandler = Handler(Looper.getMainLooper())

    private var currentReminderId: String = ""
    private var currentTitle: String = ""
    private var currentBody: String = ""
    private var currentTheme: String = ""
    private var currentStickerKey: String = ""

    private val autoDismissRunnable = Runnable {
        dismissOverlay(action = null)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        currentReminderId = intent.getStringExtra("reminderId") ?: ""
        currentTitle = intent.getStringExtra("title") ?: "Reminder"
        currentBody = intent.getStringExtra("body") ?: ""
        currentTheme = intent.getStringExtra("theme") ?: "default"
        currentStickerKey = intent.getStringExtra("stickerKey") ?: "default"

        if (currentReminderId.isEmpty()) {
            stopSelf()
            return START_NOT_STICKY
        }

        // Start transient foreground service to comply with Android 8.0+ background execution limits
        val notification = buildForegroundNotification(currentTitle, currentBody)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (_: Exception) {
            // Fallback for earlier SDKs or if FGS permission issues occur
            try {
                startForeground(NOTIFICATION_ID, notification)
            } catch (_: Exception) {
                // If startForeground fails entirely, stop safely to avoid ANR/crash
                stopSelf()
                return START_NOT_STICKY
            }
        }

        // Display floating window
        showOverlay()

        // Schedule auto-dismiss safety timer
        mainHandler.removeCallbacks(autoDismissRunnable)
        mainHandler.postDelayed(autoDismissRunnable, AUTO_DISMISS_TIMEOUT_MS)

        return START_NOT_STICKY
    }

    private fun showOverlay() {
        if (windowManager == null) return

        // Remove any previously attached overlay
        removeOverlayView()
        isActionTaken.set(false)

        val density = resources.displayMetrics.density
        val dpToPx = { dp: Int -> (dp * density).toInt() }

        // Root container to hold the card and handle positioning
        val container = FrameLayout(this)
        overlayContainer = container

        // Main Card
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dpToPx(20), dpToPx(16), dpToPx(20), dpToPx(20))

            // Dark glassmorphic background with rounded corners
            val bg = GradientDrawable().apply {
                setColor(Color.parseColor("#1C1E26"))
                cornerRadius = 24f * density
                setStroke((1f * density).toInt(), Color.parseColor("#33384C"))
            }
            background = bg
            elevation = 16f * density
        }
        cardView = card

        // Top bar containing Close (✕) button
        val topBar = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val closeButton = TextView(this).apply {
            text = "✕"
            setTextColor(Color.parseColor("#8E95A5"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setPadding(dpToPx(8), dpToPx(4), dpToPx(8), dpToPx(4))
            isClickable = true
            isFocusable = true
            val lp = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.END or Gravity.CENTER_VERTICAL
            }
            layoutParams = lp

            setOnClickListener {
                performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                dismissOverlay(action = null)
            }
        }
        topBar.addView(closeButton)
        card.addView(topBar)

        // Sticker Image
        val imageView = ImageView(this).apply {
            layoutParams = LinearLayout.LayoutParams(dpToPx(130), dpToPx(130)).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                topMargin = dpToPx(4)
                bottomMargin = dpToPx(10)
            }
            scaleType = ImageView.ScaleType.FIT_CENTER
        }

        // Resolve sticker drawable
        val drawableRes = getStickerDrawableRes(currentStickerKey, currentTheme, currentTitle)
        try {
            imageView.setImageDrawable(null)
            imageView.setImageResource(drawableRes)
            imageView.contentDescription = "$currentTitle sticker"
            imageView.visibility = View.VISIBLE
        } catch (_: Exception) {
            imageView.visibility = View.GONE
        }
        card.addView(imageView)

        // Reminder Title
        val isWater = drawableRes == R.drawable.water_pani_pilo
        val titleView = TextView(this).apply {
            val displayTitle = if (currentTitle.isNotEmpty()) {
                currentTitle
            } else if (isWater) {
                "💧 Paani Pilo!"
            } else {
                "Reminder"
            }
            text = displayTitle
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dpToPx(4)
            }
        }
        card.addView(titleView)

        // Reminder Body / Message
        if (currentBody.isNotEmpty()) {
            val bodyView = TextView(this).apply {
                text = currentBody
                setTextColor(Color.parseColor("#A0A6B8"))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = dpToPx(16)
                }
            }
            card.addView(bodyView)
        } else {
            // Space before buttons if body is empty
            val spacer = View(this).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dpToPx(12)
                )
            }
            card.addView(spacer)
        }

        // Action Buttons Row (Snooze + Done)
        val buttonRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            weightSum = 2f
        }

        // Snooze Button
        val snoozeButton = Button(this).apply {
            text = "Snooze 5m"
            isAllCaps = false
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setTextColor(Color.parseColor("#D2D6E4"))
            typeface = Typeface.DEFAULT_BOLD

            val snoozeBg = GradientDrawable().apply {
                setColor(Color.parseColor("#292D3E"))
                cornerRadius = 14f * density
                setStroke((1f * density).toInt(), Color.parseColor("#3C4258"))
            }
            background = snoozeBg

            layoutParams = LinearLayout.LayoutParams(
                0,
                dpToPx(44),
                1f
            ).apply {
                marginEnd = dpToPx(6)
            }

            setOnClickListener {
                if (isActionTaken.compareAndSet(false, true)) {
                    performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                    dismissOverlay(action = "SNOOZE")
                }
            }
        }
        buttonRow.addView(snoozeButton)

        // Done Button
        val doneButton = Button(this).apply {
            text = "Done ✓"
            isAllCaps = false
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD

            val doneBg = GradientDrawable().apply {
                setColor(Color.parseColor("#4F46E5"))
                cornerRadius = 14f * density
            }
            background = doneBg

            layoutParams = LinearLayout.LayoutParams(
                0,
                dpToPx(44),
                1f
            ).apply {
                marginStart = dpToPx(6)
            }

            setOnClickListener {
                if (isActionTaken.compareAndSet(false, true)) {
                    performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                    dismissOverlay(action = "DONE")
                }
            }
        }
        buttonRow.addView(doneButton)
        card.addView(buttonRow)

        // Add Card to Container with fixed max width
        val cardWidth = minOf(dpToPx(320), (resources.displayMetrics.widthPixels * 0.88f).toInt())
        val cardLp = FrameLayout.LayoutParams(
            cardWidth,
            FrameLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.CENTER
        }
        container.addView(card, cardLp)

        // WindowManager layout params
        val windowType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            windowType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER
        }

        try {
            windowManager?.addView(container, params)

            // Entrance animation: organic spring/overshoot
            card.alpha = 0f
            card.scaleX = 0.82f
            card.scaleY = 0.82f
            card.animate()
                .alpha(1f)
                .scaleX(1f)
                .scaleY(1f)
                .setDuration(280)
                .setInterpolator(OvershootInterpolator(1.15f))
                .start()
        } catch (_: Exception) {
            // If WindowManager fails (e.g., permission revoked dynamically), clean up
            stopSelf()
        }
    }

    private fun dismissOverlay(action: String?) {
        mainHandler.removeCallbacks(autoDismissRunnable)

        val card = cardView
        if (card != null && card.isAttachedToWindow) {
            card.animate()
                .alpha(0f)
                .scaleX(0.85f)
                .scaleY(0.85f)
                .setDuration(180)
                .withEndAction {
                    dispatchActionAndStop(action)
                }
                .start()
        } else {
            dispatchActionAndStop(action)
        }
    }

    private fun dispatchActionAndStop(action: String?) {
        when (action) {
            "DONE" -> {
                val doneIntent = Intent(this, ReminderOverlayReceiver::class.java).apply {
                    this.action = ReminderOverlayReceiver.ACTION_DONE
                    putExtra("reminderId", currentReminderId)
                }
                sendBroadcast(doneIntent)
            }
            "SNOOZE" -> {
                val snoozeIntent = Intent(this, ReminderOverlayReceiver::class.java).apply {
                    this.action = ReminderOverlayReceiver.ACTION_SNOOZE
                    putExtra("reminderId", currentReminderId)
                    putExtra("minutes", 5)
                    putExtra("title", currentTitle)
                    putExtra("body", currentBody)
                    putExtra("theme", currentTheme)
                    putExtra("stickerKey", currentStickerKey)
                }
                sendBroadcast(snoozeIntent)
            }
        }

        removeOverlayView()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }

    private fun removeOverlayView() {
        try {
            if (overlayContainer != null && overlayContainer?.isAttachedToWindow == true) {
                windowManager?.removeView(overlayContainer)
            }
        } catch (_: Exception) {
            // Safely ignored if already removed
        }
        overlayContainer = null
        cardView = null
    }

    private fun buildForegroundNotification(title: String, body: String): Notification {
        val displayTitle = if (title.isNotEmpty()) title else "Remindly"
        val displayText = if (body.isNotEmpty()) body else "Reminder due"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(displayTitle)
            .setContentText(displayText)
            .setSmallIcon(R.drawable.notification_icon)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setOngoing(true)
            .setAutoCancel(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Floating Reminders",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Active floating reminder notification"
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }
    }

    /**
     * Resolves the bundled drawable resource ID for any of the 12 Remindly categories.
     * Guaranteed to fall back safely to R.drawable.default_sticker.
     */
    private fun getStickerDrawableRes(key: String, theme: String, title: String): Int {
        val normalizedKey = key.lowercase().trim()
        val normalizedTheme = theme.lowercase().trim()
        val normalizedTitle = title.lowercase().trim()

        return when {
            // 1. Water / Hydration (Exact Pani-pilo preserved)
            normalizedKey == "water" || normalizedKey == "water-pani-pilo" || normalizedKey == "water_pani_pilo" ||
            normalizedTheme == "water" || normalizedTitle.contains("water") || normalizedTitle.contains("pilo") ||
            normalizedTitle.contains("pani") || normalizedTitle.contains("drink") || normalizedTitle.contains("hydrat") -> {
                R.drawable.water_pani_pilo
            }

            // 2. Birthday / Celebration
            normalizedKey == "birthday" || normalizedTheme == "birthday" ||
            normalizedTitle.contains("birth") || normalizedTitle.contains("anniversary") || normalizedTitle.contains("party") ||
            normalizedTitle.contains("cake") || normalizedTitle.contains("celebrat") -> {
                R.drawable.birthday
            }

            // 3. Medicine / Health
            normalizedKey == "medicine" || normalizedTheme == "medicine" ||
            normalizedTitle.contains("med") || normalizedTitle.contains("health") || normalizedTitle.contains("pill") ||
            normalizedTitle.contains("doctor") || normalizedTitle.contains("clinic") || normalizedTitle.contains("vitamin") -> {
                R.drawable.medicine
            }

            // 4. Workout / Fitness
            normalizedKey == "workout" || normalizedTheme == "workout" ||
            normalizedTitle.contains("workout") || normalizedTitle.contains("gym") || normalizedTitle.contains("exercise") ||
            normalizedTitle.contains("run") || normalizedTitle.contains("fitness") || normalizedTitle.contains("training") -> {
                R.drawable.workout
            }

            // 5. Bills / Finance
            normalizedKey == "bills" || normalizedTheme == "bills" ||
            normalizedTitle.contains("bill") || normalizedTitle.contains("finance") || normalizedTitle.contains("money") ||
            normalizedTitle.contains("pay") || normalizedTitle.contains("tax") || normalizedTitle.contains("bank") || normalizedTitle.contains("rent") -> {
                R.drawable.bills
            }

            // 6. Work / Productivity
            normalizedKey == "work" || normalizedTheme == "work" ||
            normalizedTitle.contains("work") || normalizedTitle.contains("project") || normalizedTitle.contains("meeting") ||
            normalizedTitle.contains("code") || normalizedTitle.contains("task") || normalizedTitle.contains("email") ||
            normalizedTitle.contains("client") -> {
                R.drawable.work
            }

            // 7. Stretch / Movement
            normalizedKey == "stretch" || normalizedTheme == "stretch" ||
            normalizedTitle.contains("stretch") || normalizedTitle.contains("yoga") || normalizedTitle.contains("walk") -> {
                R.drawable.stretch
            }

            // 8. Travel / Vacation
            normalizedKey == "travel" || normalizedTheme == "travel" ||
            normalizedTitle.contains("travel") || normalizedTitle.contains("flight") || normalizedTitle.contains("trip") ||
            normalizedTitle.contains("hotel") || normalizedTitle.contains("vacation") || normalizedTitle.contains("airport") -> {
                R.drawable.travel
            }

            // 9. Appointments / Calendar
            normalizedKey == "appointments" || normalizedKey == "appointment" || normalizedTheme == "appointments" ||
            normalizedTitle.contains("appoint") || normalizedTitle.contains("calendar") || normalizedTitle.contains("schedule") ||
            normalizedTitle.contains("dentist") -> {
                R.drawable.appointments
            }

            // 10. Subscriptions / Renewals
            normalizedKey == "subscriptions" || normalizedKey == "subscription" || normalizedTheme == "subscriptions" ||
            normalizedTitle.contains("sub") || normalizedTitle.contains("renew") || normalizedTitle.contains("netflix") ||
            normalizedTitle.contains("spotify") || normalizedTitle.contains("membership") -> {
                R.drawable.subscriptions
            }

            // 11. General
            normalizedKey == "general" || normalizedTheme == "general" -> {
                R.drawable.general
            }

            // 12. Default Fallback
            else -> {
                R.drawable.default_sticker
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        mainHandler.removeCallbacksAndMessages(null)
        removeOverlayView()
        windowManager = null
    }
}
