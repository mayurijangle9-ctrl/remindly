const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withReminderOverlay(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (!mainApplication) return config;

    // Ensure permissions
    if (!config.modResults.manifest['uses-permission']) {
      config.modResults.manifest['uses-permission'] = [];
    }
    const permissions = config.modResults.manifest['uses-permission'];
    const requiredPermissions = [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    ];

    for (const perm of requiredPermissions) {
      if (!permissions.some((p) => p.$?.['android:name'] === perm)) {
        permissions.push({ $: { 'android:name': perm } });
      }
    }

    // Ensure service
    if (!mainApplication.service) {
      mainApplication.service = [];
    }
    const serviceName = '.overlay.ReminderOverlayService';
    if (!mainApplication.service.some((s) => s.$?.['android:name'] === serviceName)) {
      mainApplication.service.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
          'tools:targetApi': 'upside_down_cake',
        },
        property: [
          {
            $: {
              'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
              'android:value': 'Floating reminder popup overlay',
            },
          },
        ],
      });
    }

    // Ensure receiver
    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }
    const receiverName = '.overlay.ReminderOverlayReceiver';
    if (!mainApplication.receiver.some((r) => r.$?.['android:name'] === receiverName)) {
      mainApplication.receiver.push({
        $: {
          'android:name': receiverName,
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'com.remindly.app.ACTION_REMINDER_OVERLAY_TRIGGER' } },
              { $: { 'android:name': 'com.remindly.app.ACTION_OVERLAY_DONE' } },
              { $: { 'android:name': 'com.remindly.app.ACTION_OVERLAY_SNOOZE' } },
            ],
          },
        ],
      });
    }

    return config;
  });
};
