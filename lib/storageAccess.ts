import { Platform, Linking, PermissionsAndroid } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import Constants from 'expo-constants';

const APP_PACKAGE: string =
  Constants.expoConfig?.android?.package ||
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
      }
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

async function probeDirectAccess(): Promise<boolean> {
  try {
    const { Directory } = await import('expo-file-system');
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
            continue;
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

export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    if (API_LEVEL >= 30) {
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

const SAF = (FileSystem as any)?.StorageAccessFramework;

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

export async function requestSAFPermission(
  kind?: 'wa' | 'biz'
): Promise<{ granted: boolean; uri?: string }> {
  if (Platform.OS !== 'android') return { granted: false };
  try {
    if (!SAF?.requestDirectoryPermissionsAsync) {
      throw new Error('Storage Access Framework not available on this device');
    }
    const initialUri = getInitialSAFUri(kind);
    const result = initialUri
      ? await SAF.requestDirectoryPermissionsAsync(initialUri)
      : await SAF.requestDirectoryPermissionsAsync();
    if (result?.granted && result?.directoryUri) {
      return { granted: true, uri: result.directoryUri };
    }
    return { granted: false };
  } catch (e) {
    console.error('SAF permission request failed:', e);
    return { granted: false };
  }
}

function getInitialSAFUri(kind?: 'wa' | 'biz'): string | undefined {
  try {
    if (!kind || !SAF?.getUriForDirectoryInRoot) return undefined;
    const folder =
      kind === 'biz'
        ? 'Android/media/com.whatsapp.w4b/WhatsApp Business/Media'
        : 'Android/media/com.whatsapp/WhatsApp/Media';
    const uri = SAF.getUriForDirectoryInRoot(folder);
    return typeof uri === 'string' && uri.length > 0 ? uri : undefined;
  } catch {
    return undefined;
  }
}

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

export const isAndroid11Plus = (): boolean => API_LEVEL >= 30;
