import { Platform } from 'react-native';
import { Directory, File } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

export type MediaType = 'image' | 'video';
export interface StatusFile {
  uri: string;
  name: string;
  type: MediaType;
  mtime: number | null;
  size: number;
  sourceLabel: string;
  isSAF: boolean;
  source: string;
}

const STATUS_PATHS: Array<{ path: string; label: string }> = [
  { path: '/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/.Statuses', label: 'WhatsApp' },
  { path: '/storage/emulated/0/Android/media/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses', label: 'WA Business' },
  { path: '/storage/emulated/0/WhatsApp/Media/.Statuses', label: 'WhatsApp' },
  { path: '/storage/emulated/0/WhatsApp Business/Media/.Statuses', label: 'WA Business' },
  { path: '/sdcard/WhatsApp/Media/.Statuses', label: 'WhatsApp' },
  { path: '/sdcard/Android/media/com.whatsapp/WhatsApp/Media/.Statuses', label: 'WhatsApp' },
  { path: '/storage/emulated/0/GBWhatsapp/Media/.Statuses', label: 'GBWhatsApp' },
  { path: '/storage/emulated/0/YoWhatsApp/Media/.Statuses', label: 'YoWhatsApp' },
  { path: '/storage/emulated/0/FMWhatsApp/Media/.Statuses', label: 'FMWhatsApp' },
];

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
  return name.startsWith('.') || name === 'Thumbs.db';
}

function devWarn(context: string, err?: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[statusService] ${context}`, err);
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  if (!Number.isFinite(i) || i < 0) i = 0;
  if (i >= sizes.length) i = sizes.length - 1;
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function normalizeMtime(t: number | null | undefined): number | null {
  if (t == null) return null;
  if (!Number.isFinite(t) || t <= 0) return null;
  if (t < 1_000_000_000_000) return Math.round(t * 1000);
  return Math.round(t);
}

export function formatDate(timestamp: number | null): string {
  if (!timestamp) return '';
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

function scanDir(dirPath: string, label: string, filter?: MediaType): StatusFile[] {
  try {
    const cleanPath = dirPath.replace(/^file:\/\//, '');
    const dir = new Directory(`file://${encodeURI(cleanPath)}`);
    if (!dir.exists) return [];

    let items: Array<Directory | File>;
    try {
      items = dir.list();
    } catch (e) {
      devWarn(`scanDir: dir.list() threw for ${dirPath}`, e);
      return [];
    }
    const out: StatusFile[] = [];

    for (const item of items) {
      try {
        if (!(item instanceof File)) continue;
        const name = item.name;
        if (isIgnored(name)) continue;
        const type = classify(name);
        if (!type) continue;
        if (filter && type !== filter) continue;
        out.push({
          uri: item.uri,
          name,
          type,
          mtime: normalizeMtime(item.modificationTime as unknown as number),
          size: typeof item.size === 'number' ? item.size : 0,
          sourceLabel: label,
          isSAF: false,
          source: dirPath,
        });
      } catch (e) {
        devWarn(`scanDir: skipping unreadable item in ${dirPath}`, e);
        continue;
      }
    }
    return out;
  } catch (e) {
    devWarn(`scanDir: failed for ${dirPath}`, e);
    return [];
  }
}

export async function listStatuses(filter?: MediaType): Promise<StatusFile[]> {
  if (Platform.OS !== 'android') return [];

  const all: StatusFile[] = [];
  const seen = new Set<string>();
  const push = (f: StatusFile) => {
    const key = f.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    all.push(f);
  };

  for (const { path, label } of STATUS_PATHS) {
    const files = scanDir(path, label, filter);
    for (const f of files) push(f);
  }

  try {
    const safFiles = await listSAFStatuses(filter);
    for (const f of safFiles) push(f);
  } catch (e) {
    devWarn('listStatuses: SAF merge failed', e);
  }

  all.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
  return all;
}

function extractSAFFileName(fileUri: string): string {
  try {
    const lastSegment = fileUri.split('/').pop() || fileUri;
    let decoded: string;
    try {
      decoded = decodeURIComponent(lastSegment);
    } catch {
      decoded = lastSegment;
    }
    let name = decoded;
    if (name.includes(':')) {
      const parts = name.split(':');
      name = parts[parts.length - 1];
    }
    if (name.includes('/')) {
      const parts = name.split('/');
      name = parts[parts.length - 1];
    }
    return name || decoded;
  } catch {
    return fileUri;
  }
}

async function getSAFFileInfo(fileUri: string): Promise<{ size: number; mtime: number | null }> {
  const SAF = (LegacyFS as any)?.StorageAccessFramework;
  try {
    if (typeof SAF?.getInfoAsync === 'function') {
      const info = await SAF.getInfoAsync(fileUri);
      if (info) return { size: info?.size ?? 0, mtime: normalizeMtime(info?.lastModified ?? info?.modificationTime) };
    }
  } catch {
  }
  try {
    const info: any = await LegacyFS.getInfoAsync(fileUri);
    if (info?.exists === false) return { size: 0, mtime: null };
    return { size: info?.size ?? 0, mtime: normalizeMtime(info?.modificationTime) };
  } catch {
    return { size: 0, mtime: null };
  }
}

function labelForSAFUri(uri: string): string {
  const probe = (() => {
    try {
      return decodeURIComponent(uri);
    } catch {
      return uri;
    }
  })();
  if (/w4b|business/i.test(probe)) return 'WA Business';
  if (/gbwhatsapp/i.test(probe)) return 'GBWhatsApp';
  if (/yowhatsapp/i.test(probe)) return 'YoWhatsApp';
  if (/fmwhatsapp/i.test(probe)) return 'FMWhatsApp';
  return 'WhatsApp';
}

async function isSAFDirectory(uri: string): Promise<boolean> {
  const SAF = (LegacyFS as any)?.StorageAccessFramework;
  if (!SAF?.readDirectoryAsync) return false;
  try {
    const res = await SAF.readDirectoryAsync(uri);
    return Array.isArray(res);
  } catch {
    return false;
  }
}

async function listSAFDirectory(
  directoryUri: string,
  filter?: MediaType,
  depth = 0,
  label: string = 'WhatsApp'
): Promise<StatusFile[]> {
  const MAX_DEPTH = 3;
  try {
    const SAF = (LegacyFS as any)?.StorageAccessFramework;
    if (!SAF?.readDirectoryAsync) return [];

    const entries: string[] = await SAF.readDirectoryAsync(directoryUri);
    const files: StatusFile[] = [];

    for (const entryUri of entries) {
      try {
        const fileName = extractSAFFileName(entryUri);

        if (depth < MAX_DEPTH && !classify(fileName)) {
          if (await isSAFDirectory(entryUri)) {
            const nested = await listSAFDirectory(entryUri, filter, depth + 1, label);
            files.push(...nested);
            continue;
          }
          continue;
        }

        if (isIgnored(fileName)) continue;
        const type = classify(fileName);
        if (!type) continue;
        if (filter && type !== filter) continue;

        const { size, mtime } = await getSAFFileInfo(entryUri);

        files.push({
          uri: entryUri,
          name: fileName,
          type,
          size,
          mtime,
          sourceLabel: label,
          isSAF: true,
          source: directoryUri,
        });
      } catch (e) {
        devWarn(`listSAFDirectory: skipping unreadable entry in ${directoryUri}`, e);
        continue;
      }
    }
    return files;
  } catch (e) {
    devWarn(`listSAFDirectory: failed for ${directoryUri}`, e);
    return [];
  }
}

async function listSAFStatuses(filter?: MediaType): Promise<StatusFile[]> {
  try {
    const SAF = (LegacyFS as any)?.StorageAccessFramework;
    if (!SAF?.getUriPermissionsAsync) return [];
    const permissions = await SAF.getUriPermissionsAsync();
    if (!Array.isArray(permissions) || permissions.length === 0) return [];

    const out: StatusFile[] = [];
    const seenUris = new Set<string>();
    for (const p of permissions) {
      const dirUri = p.directoryUri || p.uri;
      if (!dirUri) continue;
      const label = labelForSAFUri(dirUri);
      let files: StatusFile[];
      try {
        files = await listSAFDirectory(dirUri, filter, 0, label);
      } catch (e) {
        devWarn(`listSAFStatuses: grant failed, skipping: ${dirUri}`, e);
        continue;
      }
      for (const f of files) {
        if (seenUris.has(f.uri)) continue;
        seenUris.add(f.uri);
        out.push(f);
      }
    }
    return out;
  } catch (e) {
    devWarn('listSAFStatuses: failed', e);
    return [];
  }
}

export function decodeSAFUri(uri: string): string {
  try {
    const last = uri.split('/').pop() || uri;
    let decoded: string;
    try {
      decoded = decodeURIComponent(last);
    } catch {
      decoded = last;
    }
    const afterColon = decoded.includes(':')
      ? decoded.slice(decoded.lastIndexOf(':') + 1)
      : decoded;
    return afterColon || decoded;
  } catch {
    return uri;
  }
}

export function isContentUri(uri: string): boolean {
  return typeof uri === 'string' && uri.startsWith('content://');
}

const stagedCache = new Map<string, string>();

export async function ensureLocalUri(uri: string, name: string): Promise<string> {
  if (!isContentUri(uri)) return uri;
  const hit = stagedCache.get(uri);
  if (hit) {
    try {
      const info = await LegacyFS.getInfoAsync(hit);
      if (info.exists) return hit;
      stagedCache.delete(uri);
    } catch {
      stagedCache.delete(uri);
    }
  }
  const base = LegacyFS.cacheDirectory ?? '';
  if (!base) throw new Error('Cache directory unavailable');
  const cacheDir = `${base}status_saver_preview/`;
  const dirInfo = await LegacyFS.getInfoAsync(cacheDir);
  if (!dirInfo.exists) {
    await LegacyFS.makeDirectoryAsync(cacheDir, { intermediates: true });
  }
  const safeName = (name || 'status').replace(/[^a-zA-Z0-9._-]/g, '_');
  const dest = `${cacheDir}${Math.abs(hashString(uri))}_${safeName}`;
  await LegacyFS.copyAsync({ from: uri, to: dest });
  stagedCache.set(uri, dest);
  void pruneCacheDir(cacheDir, 40);
  return dest;
}

async function pruneCacheDir(cacheDir: string, keep: number): Promise<void> {
  try {
    const names = await LegacyFS.readDirectoryAsync(cacheDir);
    if (names.length <= keep + 10) return;
    const withTime: Array<{ name: string; t: number }> = [];
    for (const n of names) {
      try {
        const info: any = await LegacyFS.getInfoAsync(cacheDir + n);
        withTime.push({ name: n, t: info?.modificationTime ?? 0 });
      } catch {
        continue;
      }
    }
    withTime.sort((a, b) => a.t - b.t);
    const excess = withTime.slice(0, Math.max(0, withTime.length - keep));
    for (const e of excess) {
      try {
        await LegacyFS.deleteAsync(cacheDir + e.name, { idempotent: true });
      } catch {
      }
    }
  } catch {
  }
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

async function prepareFile(uri: string, name: string): Promise<string> {
  const base = LegacyFS.cacheDirectory ?? '';
  if (!base) throw new Error('Cache directory unavailable');
  const cacheDir = `${base}status_saver/`;
  const info = await LegacyFS.getInfoAsync(cacheDir);
  if (!info.exists) {
    await LegacyFS.makeDirectoryAsync(cacheDir, { intermediates: true });
  }
  const safeName = (name || 'status').replace(/[^a-zA-Z0-9._-]/g, '_');
  const rand = Math.floor(Math.random() * 1e6);
  const dest = `${cacheDir}${Date.now()}_${rand}_${safeName}`;
  await LegacyFS.copyAsync({ from: uri, to: dest });
  return dest;
}

async function deleteSilent(uri: string): Promise<void> {
  try {
    await LegacyFS.deleteAsync(uri, { idempotent: true });
  } catch {
  }
}

export async function saveToGallery(fileUri: string, fileName: string): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Gallery permission denied. Go to Settings and allow storage access.');

  const local = await prepareFile(fileUri, fileName);
  try {
    const asset = await MediaLibrary.createAssetAsync(local);

    try {
      const album = await MediaLibrary.getAlbumAsync('Status Saver');
      if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      else await MediaLibrary.createAlbumAsync('Status Saver', asset, false);
    } catch {
    }
  } finally {
    await deleteSilent(local);
  }
}

export async function shareFile(fileUri: string, fileName: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing not available on this device');
  const local = await prepareFile(fileUri, fileName);
  try {
    await Sharing.shareAsync(local, { dialogTitle: 'Share Status' });
  } finally {
    await deleteSilent(local);
  }
}

export async function shareToWhatsApp(
  fileUri: string,
  fileName: string,
  sourceLabel?: string,
  source?: string
): Promise<void> {
  const mimeType = /\.(mp4|mkv|avi|mov|3gp)$/i.test(fileName) ? 'video/*' : 'image/*';
  const business = isBusinessSource(sourceLabel, source);

  const local = await prepareFile(fileUri, fileName);
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing not available on this device');
    await Sharing.shareAsync(local, {
      dialogTitle: business ? 'Share to WhatsApp Business' : 'Share to WhatsApp',
      mimeType,
    });
  } finally {
    await deleteSilent(local);
  }
}

export function isBusinessSource(sourceLabel?: string, source?: string): boolean {
  const probe = `${sourceLabel ?? ''} ${source ?? ''}`;
  return /business|w4b/i.test(probe);
}
