import { Platform, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

// ─── Storage Access Framework (SAF) Permissions ───────────────────────────────
/**
 * Check if user has granted SAF permission to any folder
 */
export async function hasSAFPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  
  try {
    const SAF = (FileSystem as any).StorageAccessFramework;
    if (!SAF?.getUriPermissionsAsync) return false;
    
    const permissions = await SAF.getUriPermissionsAsync();
    return Array.isArray(permissions) && permissions.length > 0;
  } catch {
    return false;
  }
}

/**
 * Request SAF directory access - opens system folder picker
 * User needs to navigate to WhatsApp/.Statuses folder
 */
export async function requestSAFPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  
  try {
    const SAF = (FileSystem as any).StorageAccessFramework;
    if (!SAF?.requestDirectoryPermissionsAsync) {
      throw new Error('Storage Access Framework not available on this device');
    }
    
    const result = await SAF.requestDirectoryPermissionsAsync();
    return !!result?.granted;
  } catch (error) {
    console.error('SAF request failed:', error);
    return false;
  }
}

/**
 * Get list of all granted SAF directory URIs
 */
export async function getGrantedSAFUris(): Promise<string[]> {
  if (Platform.OS !== 'android') return [];
  
  try {
    const SAF = (FileSystem as any).StorageAccessFramework;
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

// ─── Media Library Permissions (for saving to gallery) ────────────────────────
/**
 * Check if we have media library permission (needed for saving)
 */
export async function hasMediaLibraryPermission(): Promise<boolean> {
  try {
    const permission = await MediaLibrary.getPermissionsAsync();
    return permission.granted;
  } catch {
    return false;
  }
}

/**
 * Request media library permission
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const result = await MediaLibrary.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}

// ─── Combined Permission Checks ───────────────────────────────────────────────
/**
 * Check if we have all necessary permissions to view and save statuses
 */
export async function hasAllPermissions(): Promise<{ canView: boolean; canSave: boolean }> {
  const [safPerm, mediaPerm] = await Promise.all([
    hasSAFPermission(),
    hasMediaLibraryPermission(),
  ]);
  
  return {
    canView: safPerm,  // Need SAF to view WhatsApp statuses
    canSave: mediaPerm, // Need MediaLibrary to save to gallery
  };
}

// ─── Settings ─────────────────────────────────────────────────────────────────
/**
 * Open app settings where user can manage permissions
 */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (error) {
    console.error('Failed to open settings:', error);
  }
}

// ─── Platform Check ───────────────────────────────────────────────────────────
export function isAndroid(): boolean {
  return Platform.OS === 'android';
}

export function isAndroid11Plus(): boolean {
  if (Platform.OS !== 'android') return false;
  
  // Platform.Version is the Android API level on Android
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;
  return apiLevel >= 30; // Android 11 is API 30
}
