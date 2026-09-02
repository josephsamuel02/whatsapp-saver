import { Platform, Linking } from "react-native";
import * as LegacyFS from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";

export type AccessState = "checking" | "granted" | "blocked" | "needsSAF";

export async function checkAllFilesAccess(): Promise<boolean> {
  // Direct detection: try to list one canonical .Statuses dir
  if (Platform.OS !== "android") return true;
  try {
    const { Directory } = await import("expo-file-system");
    const test = new Directory("/storage/emulated/0/WhatsApp/Media/.Statuses");
    // Accessing exists will throw if no permission on Android 11+ without MANAGE_EXTERNAL_STORAGE
    return test.exists || true; // if no throw, we have some access
  } catch { return false; }
}

export async function checkMediaLibraryAccess(): Promise<boolean> {
  try {
    const p = await MediaLibrary.getPermissionsAsync();
    return !!p.granted;
  } catch { return false; }
}

export async function hasAnyAccess(): Promise<boolean> {
  const [media] = await Promise.all([checkMediaLibraryAccess()]);
  const SAF: any = (LegacyFS as any).StorageAccessFramework;
  let safGranted = false;
  try { const l = await SAF?.getPersistedUriPermissionsAsync?.(); safGranted = !!(l && Array.isArray(l) && l.length); } catch {}
  return media || safGranted;
}

export async function requestMediaPermissions(): Promise<boolean> {
  const r = await MediaLibrary.requestPermissionsAsync();
  return !!r.granted;
}

export async function requestSAF(): Promise<boolean> {
  const SAF: any = (LegacyFS as any).StorageAccessFramework;
  if (!SAF?.requestDirectoryPermissionsAsync) throw new Error("File access framework not supported on this device");
  const res = await SAF.requestDirectoryPermissionsAsync();
  if (res?.granted) return true;
  return false;
}

export async function openAllFilesSettings(): Promise<void> {
  // On Android 11+ MANAGE_EXTERNAL_STORAGE permission opens special Settings page
  // Linking.openSettings() opens app settings where user can toggle "Allow management of all files"
  await Linking.openSettings();
}

export function isAndroid(): boolean { return Platform.OS === "android"; }
