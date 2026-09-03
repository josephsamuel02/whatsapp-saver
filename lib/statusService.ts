import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

// ─── Types ────────────────────────────────────────────────────────────────────
export type MediaType = 'image' | 'video';
export interface StatusFile {
  uri: string;
  name: string;
  type: MediaType;
  mtime: number | null;
  size: number;
  sourceLabel?: string;
  isSAF?: boolean;
  source?: string;
}

// ─── File Classification ──────────────────────────────────────────────────────
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXT = new Set(['.mp4', '.3gp', '.mkv', '.mov', '.avi']);

function classify(name: string): MediaType | null {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (VIDEO_EXT.has(ext)) return 'video';
  return null;
}

function isIgnored(name: string) {
  return name === '.nomedia' || name.startsWith('.') || name === 'Thumbs.db';
}

// ─── Helper Functions ─────────────────────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatDate(timestamp: number | null): string {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Storage Access Framework (SAF) - PRIMARY METHOD ──────────────────────────
/**
 * Check if we have SAF permission granted to any WhatsApp status folder
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
 * Request SAF permission - opens folder picker for user to select WhatsApp .Statuses folder
 */
export async function requestSAFPermission(): Promise<{ granted: boolean; uri?: string }> {
  if (Platform.OS !== 'android') {
    return { granted: false };
  }

  try {
    const SAF = (FileSystem as any).StorageAccessFramework;
    if (!SAF?.requestDirectoryPermissionsAsync) {
      throw new Error('Storage Access Framework not available');
    }

    const result = await SAF.requestDirectoryPermissionsAsync();
    
    if (result.granted && result.directoryUri) {
      return { granted: true, uri: result.directoryUri };
    }
    
    return { granted: false };
  } catch (error) {
    console.error('SAF permission request failed:', error);
    return { granted: false };
  }
}

/**
 * List files from a SAF directory URI
 */
async function listSAFDirectory(directoryUri: string, filter?: MediaType): Promise<StatusFile[]> {
  try {
    const SAF = (FileSystem as any).StorageAccessFramework;
    if (!SAF?.readDirectoryAsync) return [];

    const fileUris = await SAF.readDirectoryAsync(directoryUri);
    const files: StatusFile[] = [];

    for (const fileUri of fileUris) {
      try {
        // Extract filename from URI
        let fileName = decodeURIComponent(fileUri.split('/').pop() || '');
        
        // Handle Android document URI format
        if (fileName.includes(':')) {
          fileName = fileName.split(':').pop() || fileName;
        }

        // Skip ignored files
        if (isIgnored(fileName)) continue;

        // Classify file type
        const type = classify(fileName);
        if (!type) continue;
        if (filter && type !== filter) continue;

        // Get file info
        let size = 0;
        let mtime: number | null = null;
        
        try {
          const info = await SAF.getInfoAsync(fileUri);
          size = info.size || 0;
          mtime = info.lastModified || null;
        } catch {
          // Continue even if we can't get file info
        }

        files.push({
          uri: fileUri,
          name: fileName,
          type,
          size,
          mtime,
          sourceLabel: 'WhatsApp',
          isSAF: true,
        });
      } catch (error) {
        // Skip files that cause errors
        continue;
      }
    }

    // Sort by modification time (newest first)
    files.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    
    return files;
  } catch (error) {
    console.error('Error reading SAF directory:', error);
    return [];
  }
}

/**
 * Main function to list WhatsApp statuses
 * Uses SAF as primary method for Android 11+
 */
export async function listStatuses(filter?: MediaType): Promise<StatusFile[]> {
  if (Platform.OS !== 'android') return [];

  try {
    const SAF = (FileSystem as any).StorageAccessFramework;
    if (!SAF?.getUriPermissionsAsync) return [];

    // Get all granted directory permissions
    const permissions = await SAF.getUriPermissionsAsync();
    
    if (!permissions || permissions.length === 0) {
      return [];
    }

    // Collect files from all granted directories
    const allFiles: StatusFile[] = [];
    const seenUris = new Set<string>();

    for (const permission of permissions) {
      const directoryUri = permission.directoryUri || permission.uri;
      if (!directoryUri) continue;

      const files = await listSAFDirectory(directoryUri, filter);
      
      // Deduplicate by URI
      for (const file of files) {
        if (!seenUris.has(file.uri)) {
          seenUris.add(file.uri);
          allFiles.push(file);
        }
      }
    }

    // Final sort by modification time
    allFiles.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    
    return allFiles;
  } catch (error) {
    console.error('Error listing statuses:', error);
    return [];
  }
}

// ─── Save & Share Functions ───────────────────────────────────────────────────
/**
 * Copy file to cache for sharing/saving (SAF URIs need to be copied first)
 */
async function prepareFileForOperation(uri: string, fileName: string): Promise<string> {
  // If it's already a file:// URI, return as is
  if (uri.startsWith('file://')) {
    return uri;
  }

  // For content:// URIs from SAF, copy to cache
  try {
    const cacheDir = (FileSystem as any).cacheDirectory + 'status_temp/';
    
    // Ensure cache directory exists
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    }

    // Create unique filename
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const destUri = `${cacheDir}${timestamp}_${safeName}`;

    // Copy file
    await FileSystem.copyAsync({
      from: uri,
      to: destUri,
    });

    return destUri;
  } catch (error) {
    console.error('Error preparing file:', error);
    throw new Error('Could not prepare file for operation');
  }
}

/**
 * Save a status file to device gallery
 */
export async function saveToGallery(fileUri: string, fileName: string): Promise<void> {
  try {
    // Request media library permission
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Gallery permission denied. Please allow photo access in Settings.');
    }

    // Prepare file (copy SAF URI to cache if needed)
    const localUri = await prepareFileForOperation(fileUri, fileName);

    // Create asset in gallery
    const asset = await MediaLibrary.createAssetAsync(localUri);

    // Try to add to album
    try {
      const album = await MediaLibrary.getAlbumAsync('Status Saver');
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync('Status Saver', asset, false);
      }
    } catch {
      // Album creation might fail on some devices, but asset is still saved
    }
  } catch (error) {
    console.error('Save to gallery failed:', error);
    throw error;
  }
}

/**
 * Save multiple files to gallery
 */
export async function saveMultipleToGallery(files: StatusFile[]): Promise<{ saved: number; errors: number }> {
  let saved = 0;
  let errors = 0;

  for (const file of files) {
    try {
      await saveToGallery(file.uri, file.name);
      saved++;
    } catch {
      errors++;
    }
  }

  return { saved, errors };
}

/**
 * Share a file using system share sheet
 */
export async function shareFile(fileUri: string, fileName: string): Promise<void> {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      throw new Error('Sharing is not available on this device');
    }

    // Prepare file
    const localUri = await prepareFileForOperation(fileUri, fileName);

    // Share
    await Sharing.shareAsync(localUri, {
      dialogTitle: 'Share Status',
    });
  } catch (error) {
    console.error('Share failed:', error);
    throw error;
  }
}

/**
 * Share directly to WhatsApp
 */
export async function shareToWhatsApp(fileUri: string, fileName: string): Promise<void> {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      throw new Error('Sharing is not available on this device');
    }

    // Prepare file
    const localUri = await prepareFileForOperation(fileUri, fileName);

    // Share with WhatsApp hint in dialog
    await Sharing.shareAsync(localUri, {
      dialogTitle: 'Share to WhatsApp',
      mimeType: fileName.match(/\.(mp4|mkv|avi|mov)$/i) ? 'video/*' : 'image/*',
    });
  } catch (error) {
    console.error('Share to WhatsApp failed:', error);
    throw error;
  }
}
