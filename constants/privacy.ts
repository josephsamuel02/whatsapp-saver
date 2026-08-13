export const PRIVACY_POLICY = {
  lastUpdated: 'August 12, 2026',
  appName: 'Status Saver',
  sections: [
    {
      title: '1. Overview',
      body: 'Status Saver helps you save WhatsApp Status images and videos that you have already viewed on your device. The app works entirely on-device and does not collect, transmit, or store your personal data on any external server.',
    },
    {
      title: '2. What We Access',
      body: 'With your permission, the app reads files from the WhatsApp .Statuses folder on your device storage (e.g., /WhatsApp/Media/.Statuses or /Android/media/com.whatsapp/...). It only reads image and video files you have already viewed. No chat messages, contacts, or other WhatsApp data are accessed.',
    },
    {
      title: '3. Permissions Used',
      body: '• Storage / Media permissions (READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, READ_EXTERNAL_STORAGE) to list and copy status files.\n• Write / Media Library permission to save a copy of a status to your gallery when you tap Save.\nYou can revoke these permissions at any time in Android Settings > Apps > Status Saver > Permissions. The app will then stop listing statuses.',
    },
    {
      title: '4. Data Collection',
      body: 'We do not collect personal data. We do not use analytics, tracking SDKs, or advertising SDKs. No data leaves your device except when you explicitly use Share to send a file via another app you choose.',
    },
    {
      title: '5. Data Storage',
      body: 'All status files remain on your device. When you tap Save, a copy is added to your public gallery (DCIM/Status Saver). The app does not upload files to the cloud.',
    },
    {
      title: '6. WhatsApp Trademark',
      body: 'WhatsApp is a trademark of Meta Platforms, Inc. Status Saver is not affiliated with, endorsed by, or sponsored by WhatsApp or Meta. Please only save statuses with the permission of the person who posted them and respect their privacy.',
    },
    {
      title: '7. Children\'s Privacy',
      body: 'This app is not directed to children under 13 and does not knowingly collect data from children.',
    },
    {
      title: '8. Your Choices',
      body: 'You can delete any saved status from your gallery at any time. Uninstalling the app removes its private cache but does not delete files you already saved to the gallery.',
    },
    {
      title: '9. Changes to This Policy',
      body: 'If we update this policy, we will update the Last Updated date above and show the new version inside the app.',
    },
    {
      title: '10. Contact',
      body: 'Questions? Contact us at support@statussaver.app',
    },
  ],
} as const;
