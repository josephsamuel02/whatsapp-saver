# WhatsApp Status Saver

A React Native app built with Expo that allows you to save WhatsApp and WhatsApp Business status images and videos to your device.

## 🚀 Features

- ✅ View WhatsApp status images and videos
- ✅ Save individual or multiple statuses to your gallery
- ✅ Share statuses directly to WhatsApp or other apps
- ✅ Support for WhatsApp and WhatsApp Business
- ✅ Works on Android 11+ using Storage Access Framework (SAF)
- ✅ Multi-select functionality with long-press
- ✅ Automatic status scanning and refresh

## 📱 Requirements

- **Android 5.0+** (API level 21+)
- **Android 11+** recommended for best experience
- WhatsApp or WhatsApp Business installed on your device

## 🔧 Installation

### For Development

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd whatsapp-saver
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Run on Android device:**
   ```bash
   npm run android
   ```

### For Users (APK Installation)

1. Download the latest APK from the releases page
2. Enable "Install from Unknown Sources" in your Android settings
3. Install the APK
4. Grant folder access permission when prompted

## 📖 How to Use

### First Time Setup

1. **Open the app** - You'll see a permission screen
2. **Tap "Select Folder"** - This opens the Android folder picker
3. **Navigate to the WhatsApp Status folder:**
   - For WhatsApp: `Android → media → com.whatsapp → WhatsApp → Media → .Statuses`
   - For WhatsApp Business: `Android → media → com.whatsapp.w4b → WhatsApp Business → Media → .Statuses`
4. **Tap "Use this folder"** or "Allow" to grant access

> **Note:** The `.Statuses` folder may be hidden. Look for "Show hidden files" option in your file picker.

### Viewing and Saving Statuses

1. **Open WhatsApp** and view any status you want to save
2. **Return to Status Saver** and pull down to refresh
3. **Tap on any status** to preview it
4. **Save or Share:**
   - Tap the **Download** button to save to your gallery (Album: Status Saver)
   - Tap the **Share** button to share via system share sheet
   - Tap the **WhatsApp** button to share directly to WhatsApp

### Multi-Select Mode

1. **Long-press on any status** to enter selection mode
2. **Tap additional statuses** to select multiple
3. **Tap "Save Selected"** to save all selected statuses at once
4. **Tap "Clear"** to exit selection mode

## 🔐 Permissions Explained

### Storage Access Framework (SAF)
- **Why:** Android 11+ requires explicit folder access for security
- **What it does:** Grants the app permission to read WhatsApp's status folder
- **Privacy:** Only the folder you select is accessible - nothing else

### Media Library (Photos)
- **Why:** Needed to save statuses to your device gallery
- **What it does:** Allows the app to create a "Status Saver" album in your gallery
- **Privacy:** Only saves files you explicitly choose to save

## 🛠️ Technical Details

### Architecture

- **Framework:** React Native with Expo
- **Storage Method:** Storage Access Framework (SAF) - compatible with Android 11+
- **File Access:** Uses `expo-file-system` with SAF APIs
- **Media Library:** Uses `expo-media-library` for saving to gallery

### Why SAF Instead of Direct File Access?

Starting with Android 11 (API 30), Google introduced **Scoped Storage** which prevents apps from directly accessing other apps' files in `/Android/data/` and `/Android/media/` directories. 

This app uses **Storage Access Framework (SAF)** which:
- ✅ Works on all Android versions 11+
- ✅ Complies with Google Play Store policies
- ✅ Gives users full control over what folders apps can access
- ✅ More secure and privacy-friendly

### Key Files

- `lib/statusService.ts` - Status file scanning and management using SAF
- `lib/storageAccess.ts` - Permission handling and SAF utilities
- `components/PermissionGate.tsx` - Permission request UI with instructions
- `app/(tabs)/images.tsx` - Image statuses tab
- `app/(tabs)/videos.tsx` - Video statuses tab

## ❓ Troubleshooting

### "No statuses found"
1. Make sure you've granted folder access permission
2. Open WhatsApp and view some statuses
3. Return to the app and pull down to refresh
4. Remember: WhatsApp deletes viewed statuses after 24 hours

### "Permission denied" or "Could not access folder"
1. Go to Settings → Apps → Status Saver → Permissions
2. Revoke folder access and try again
3. Make sure you're selecting the correct `.Statuses` folder

### ".Statuses folder not visible"
1. In the folder picker, look for a menu option (⋮)
2. Enable "Show hidden files" or "Show hidden folders"
3. Hidden folders start with a dot (.)

### Statuses disappeared
WhatsApp automatically deletes viewed statuses after:
- 24 hours after posting
- When the user who posted it deletes it
- When you clear WhatsApp cache

**Solution:** Save statuses to your gallery before they expire.

## 🔄 What's Different From Old Version

### ❌ Old Method (Doesn't Work on Android 11+)
- Direct file system access to `/storage/emulated/0/WhatsApp/...`
- Required `MANAGE_EXTERNAL_STORAGE` permission
- Rejected by Google Play Store
- Broken on Android 11+

### ✅ New Method (Works on Android 11+)
- Storage Access Framework (SAF) with folder picker
- User grants access to specific folder only
- Compliant with Play Store policies
- Secure and privacy-friendly

## 📦 Building for Production

### Build APK
```bash
eas build --platform android --profile preview
```

### Build AAB (for Play Store)
```bash
eas build --platform android --profile production
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is for educational purposes. WhatsApp is a trademark of Meta Platforms, Inc.

## ⚠️ Disclaimer

This app is not affiliated with, endorsed by, or connected to WhatsApp or Meta Platforms, Inc. Use at your own risk. Always respect the privacy of others and only save statuses you have permission to save.

## 🐛 Known Issues

- Video thumbnails may load slowly on some devices
- Some OEM Android versions may have different folder structures
- WhatsApp Business might use different paths on some devices

## 📞 Support

If you encounter any issues, please open an issue on GitHub with:
- Your Android version
- Device model
- WhatsApp version
- Screenshots of the error

---

**Made with ❤️ using React Native & Expo**
