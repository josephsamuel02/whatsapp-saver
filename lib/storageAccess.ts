import { Platform, Linking, PermissionsAndroid } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import Constants from 'expo-constants';

// ─── MANAGE_EXTERNAL_STORAGE ───────────────────────────────────────────────────
// On Android 11+ (API 30+) this is a "special" permission that can only be
// granted from the system "All files access" settings page — not via a runtime
// dialog. On Android ≤10 the regular READ_EXTERNAL_STORAGE is sufficient.
// NOTE: Google Play restricts MANAGE_EXTERNAL_STORAGE to core file-manager use
// cases. Status-saver apps distributed via Play should prefer the SAF folder
// picker below (Play-compliant). Direct access remains useful for sideloaded
// builds, so this app supports BOTH and tries direct first, SAF as fallback.

// BUG FIX: this used to be a hardcoded literal ('com.statussaver.app'). If that
// string didn't exactly match the real `android.package` in app.json, the
// intent below would silently fail to resolve and fall back to the generic
// "All files access" list — the user then has to hunt for the app manually,
// which looks exactly like "Allow storage access doesn't work". Pulling it
// from app config means it can never drift out of sync with the actual build.
const APP_PACKAGE: string =
  Constants.expoConfig?.android?.package ||
  // Fallback path for older/standalone manifest shapes
  (Constants as any)?.manifest2?.extra?.expoClient?.android?.package ||
  (Constants as any)?.manifest?.android?.package ||
  '';

if (__DEV__ && !APP_PACKAGE) {
  console.warn(
    '[storageAccess] Could not resolve android.package from app config — ' +
      '"Allow All files access" will fall back to the generic Settings list ' +
      'instead of opening this app directly. Check app.json → expo.android.package.'
  );
}

const API_LEVEL = Platform.OS === 'android'
  ? (typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10))
  : 0;

/**
 * Returns true if we already have the storage access needed to read WhatsApp folders.
 * - Android 11+ : MANAGE_EXTERNAL_STORAGE ("All files access") OR probe succeeds
 * - Android ≤10 : READ_EXTERNAL_STORAGE
 *
 * NOTE: PermissionsAndroid.check(MANAGE_EXTERNAL_STORAGE) is unreliable on some
 * OEMs / Expo builds — it can return false even when the toggle is ON. So we
 * ALSO probe the real filesystem: if we can list a known WhatsApp dir (or the
 * shared-media root), permission is effectively granted regardless of what the
 * check API reports. This is what makes the grant "stick" across restarts.
 */
export async function hasStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    if (API_LEVEL >= 30) {
      try {
        const result = await PermissionsAndroid.check(
          'android.permission.MANAGE_EXTERNAL_STORAGE' as any
        );
        if (result) return true;
      } catch {
        // fall through to probe
      }
      // Check-API said no (or threw) — verify with a real filesystem probe
      // before reporting "not granted".
      return await probeDirectAccess();
    } else {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      return result;
    }
  } catch {
    return false;
  }
}

/** Try to actually list a directory — the ground truth for "can we read?". */
async function probeDirectAccess(): Promise<boolean> {
  try {
    const { Directory } = await import('expo-file-system');
    // ONLY probe real .Statuses folders. Probing generic roots like
    // Android/media would return true even WITHOUT the permission (the top
    // level is listable under scoped storage) and hide the permission gate
    // while the grid stays empty — a false positive.
    // (Keep in sync with STATUS_PATHS in statusService.ts.)
    const candidates = [
      'file:///storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/.Statuses',
      'file:///storage/emulated/0/Android/media/com.whatsapp.w4b/WhatsApp%20Business/Media/.Statuses',
      'file:///storage/emulated/0/WhatsApp/Media/.Statuses',
      'file:///storage/emulated/0/WhatsApp%20Business/Media/.Statuses',
      'file:///sdcard/WhatsApp/Media/.Statuses',
      'file:///sdcard/Android/media/com.whatsapp/WhatsApp/Media/.Statuses',
    ];
    for (const uri of candidates) {
      try {
        const dir = new Directory(uri);
        if (dir.exists) {
          try {
            dir.list();
          } catch {
            continue; // exists but not listable → no real access
          }
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Request storage permission.
 * - Android 11+ : Opens the "All files access" system settings page. The grant
 *   happens OUTSIDE the app, so this function can NOT return the final result —
 *   it opens Settings and returns false. Callers must re-check with
 *   hasStoragePermission() when the app returns to foreground (AppState
 *   'active' / screen focus). The previous implementation re-checked
 *   immediately after opening Settings (before the user acted), which always
 *   returned false and looked like "permission failing even after I give it".
 * - Android ≤10 : Shows a standard runtime permission dialog.
 */
export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    if (API_LEVEL >= 30) {
      // Can't request MANAGE_EXTERNAL_STORAGE via the dialog API.
      // Open Settings > All files access for this app; caller re-checks on return.
      await openAllFilesAccessSettings();
      return false;
    } else {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Access',
          message:
            'Status Saver needs access to your storage to find WhatsApp statuses.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch {
    return false;
  }
}

/**
 * Open the "All files access" settings page directly (Android 11+).
 * Uses expo-intent-launcher with ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION
 * so the toggle for THIS app opens — the previous `Linking.openURL('package:…')`
 * implementation was an invalid URL and never opened Settings.
 * Falls back to general app settings on older versions.
 */
export async function openAllFilesAccessSettings(): Promise<void> {
  try {
    if (API_LEVEL >= 30) {
      await IntentLauncher.startActivityAsync(
        'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
        { data: `package:${APP_PACKAGE}` }
      );
    } else {
      await Linking.openSettings();
    }
  } catch {
    try {
      // Fallback: generic "All files access" list, then app settings
      if (API_LEVEL >= 30) {
        await IntentLauncher.startActivityAsync(
          'android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION'
        );
      } else {
        await Linking.openSettings();
      }
    } catch {
      await Linking.openSettings().catch(() => {});
    }
  }
}

// ─── Media Library (for saving to gallery) ────────────────────────────────────
export async function hasMediaLibraryPermission(): Promise<boolean> {
  try {
    const p = await MediaLibrary.getPermissionsAsync();
    return p.granted;
  } catch {
    return false;
  }
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const r = await MediaLibrary.requestPermissionsAsync();
    return r.granted;
  } catch {
    return false;
  }
}

// ─── Storage Access Framework (Play-Store-compliant fallback) ───────────────
// MANAGE_EXTERNAL_STORAGE is restricted by Google Play and unsuitable for
// status-saver apps distributed via the store. SAF lets the user grant access
// to just the `.Statuses` folder via the system folder picker — no special
// permission declaration needed.
const SAF = (FileSystem as any)?.StorageAccessFramework;

/** True if the user granted SAF access to at least one folder. */
export async function hasSAFPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    if (!SAF?.getUriPermissionsAsync) return false;
    const permissions = await SAF.getUriPermissionsAsync();
    return Array.isArray(permissions) && permissions.length > 0;
  } catch {
    return false;
  }
}

/** Open the system folder picker so the user can select the `.Statuses` folder. */
export async function requestSAFPermission(): Promise<{ granted: boolean; uri?: string }> {
  if (Platform.OS !== 'android') return { granted: false };
  try {
    if (!SAF?.requestDirectoryPermissionsAsync) {
      throw new Error('Storage Access Framework not available on this device');
    }
    const result = await SAF.requestDirectoryPermissionsAsync();
    if (result?.granted && result?.directoryUri) {
      return { granted: true, uri: result.directoryUri };
    }
    return { granted: false };
  } catch (e) {
    console.error('SAF permission request failed:', e);
    return { granted: false };
  }
}

/** All SAF directory URIs the user has granted. */
export async function getGrantedSAFUris(): Promise<string[]> {
  if (Platform.OS !== 'android') return [];
  try {
    if (!SAF?.getUriPermissionsAsync) return [];
    const permissions = await SAF.getUriPermissionsAsync();
    if (!Array.isArray(permissions)) return [];
    return permissions
      .map((p: any) => p.directoryUri || p.uri)
      .filter((uri: any): uri is string => typeof uri === 'string');
  } catch {
    return [];
  }
}

// ─── Convenience ─────────────────────────────────────────────────────────────
export const isAndroid11Plus = (): boolean => API_LEVEL >= 30;
