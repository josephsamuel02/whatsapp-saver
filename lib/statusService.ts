import { Platform } from 'react-native';
import { Directory, File } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
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
  sourceLabel: string;
  isSAF: boolean;
  source: string;
}

// ─── WhatsApp status folder paths ────────────────────────────────────────────
// Covers official WhatsApp, WhatsApp Business, legacy paths, and mod variants
const STATUS_PATHS: Array<{ path: string; label: string }> = [
  // WhatsApp — Android 10+ scoped (most common on modern devices)
  { path: '/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/.Statuses', label: 'WhatsApp' },
  // WhatsApp Business — Android 10+ scoped
  { path: '/storage/emulated/0/Android/media/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses', label: 'WA Business' },
  // Legacy WhatsApp (pre-Android 10 / old installs)
  { path: '/storage/emulated/0/WhatsApp/Media/.Statuses', label: 'WhatsApp' },
  // Legacy WhatsApp Business
  { path: '/storage/emulated/0/WhatsApp Business/Media/.Statuses', label: 'WA Business' },
  // sdcard alias (some OEMs)
  { path: '/sdcard/WhatsApp/Media/.Statuses', label: 'WhatsApp' },
  { path: '/sdcard/Android/media/com.whatsapp/WhatsApp/Media/.Statuses', label: 'WhatsApp' },
  // GB/Yo/FM WhatsApp mods
  { path: '/storage/emulated/0/GBWhatsapp/Media/.Statuses', label: 'GBWhatsApp' },
  { path: '/storage/emulated/0/YoWhatsApp/Media/.Statuses', label: 'YoWhatsApp' },
  { path: '/storage/emulated/0/FMWhatsApp/Media/.Statuses', label: 'FMWhatsApp' },
];

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
  return name.startsWith('.') || name === 'Thumbs.db';
}

/**
 * Every catch block below used to swallow errors silently and just return
 * an empty array — meaning a real scanning failure (bad metadata read, a
 * SecurityException, an API mismatch) looked EXACTLY like "no statuses
 * found". That makes "images/videos aren't showing up" impossible to
 * diagnose. Route every catch through this so real failures show up in
 * Metro/logcat during development instead of vanishing.
 */
function devWarn(context: string, err?: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[statusService] ${context}`, err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  if (!Number.isFinite(i) || i < 0) i = 0;
  if (i >= sizes.length) i = sizes.length - 1;
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Normalize timestamps to milliseconds.
 * expo-file-system's legacy getInfoAsync returns seconds on some SDKs while
 * the new Directory/File API returns ms — mixing them breaks both sorting
 * (ms always "newer") and display (seconds render as Jan 1970).
 */
export function normalizeMtime(t: number | null | undefined): number | null {
  if (t == null) return null;
  if (!Number.isFinite(t) || t <= 0) return null;
  // Anything below 1e12 is seconds (or garbage) — convert to ms.
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

// ─── Directory scanner ────────────────────────────────────────────────────────
function scanDir(dirPath: string, label: string, filter?: MediaType): StatusFile[] {
  try {
    // Paths like "WhatsApp Business" contain spaces — a raw file:// URI is
    // invalid and Directory.exists would always be false. encodeURI keeps
    // slashes intact while escaping spaces.
    const cleanPath = dirPath.replace(/^file:\/\//, '');
    const dir = new Directory(`file://${encodeURI(cleanPath)}`);
    if (!dir.exists) return [];

    let items: Array<Directory | File>;
    try {
      items = dir.list();
    } catch (e) {
      // dir.exists said true but list() still failed — that's a real
      // permission/IO problem worth knowing about, not "folder is empty".
      devWarn(`scanDir: dir.list() threw for ${dirPath}`, e);
      return [];
    }
    const out: StatusFile[] = [];

    for (const item of items) {
      // One bad entry (e.g. a metadata read that throws) must not take the
      // whole folder's results down with it — previously an exception here
      // would bubble to the outer catch and discard every file already found.
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

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Scan all known WhatsApp status directories and return unique files.
 *
 * Hybrid strategy (Play-Store-compliant):
 *  1. Fast path — direct scan (needs MANAGE_EXTERNAL_STORAGE / sideloaded builds).
 *  2. SAF — Storage Access Framework persisted folder grants (user picks the
 *     `.Statuses` folder once). ALWAYS merged in, not only when direct finds
 *     nothing — otherwise a single stray file on the direct path would hide
 *     the whole SAF grant and the grid would look empty/wrong.
 */
export async function listStatuses(filter?: MediaType): Promise<StatusFile[]> {
  if (Platform.OS !== 'android') return [];

  const all: StatusFile[] = [];
  // Dedupe by lowercased file name. SAF getInfo can fail (size 0, mtime null)
  // while the direct scan has real values — keying on name+size would then
  // keep both copies. Direct results are pushed first so they win.
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

  // SAF fallback — ALWAYS merged (previously only when direct found nothing).
  try {
    const safFiles = await listSAFStatuses(filter);
    for (const f of safFiles) push(f);
  } catch (e) {
    // SAF listing must never break the direct path
    devWarn('listStatuses: SAF merge failed', e);
  }

  // Sort newest first
  all.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
  return all;
}

// ─── SAF listing (Play-Store-compliant fallback) ─────────────────────────────
// The system picker often hides dot-folders, so users end up picking a PARENT
// (…/Media or …/WhatsApp) instead of `.Statuses` itself. Listing must therefore
// recurse a few levels and find statuses wherever they live under the grant.

/**
 * Extract a real file name from an SAF document URI.
 * URIs look like: content://…/document/primary%3AAndroid%2Fmedia%2F…%2Fabc.jpg
 * Naively taking everything after ':' leaves "Android/media/…/abc.jpg" — still
 * a path, not a name. We must strip to the last '/' segment.
 */
function extractSAFFileName(fileUri: string): string {
  try {
    const lastSegment = fileUri.split('/').pop() || fileUri;
    let decoded: string;
    try {
      decoded = decodeURIComponent(lastSegment);
    } catch {
      decoded = lastSegment;
    }
    // decoded is like "primary:Android/media/…/abc.jpg"
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
  // expo-file-system's SAF object has no getInfoAsync — try it if present,
  // then fall back to the generic getInfoAsync which understands content://.
  try {
    if (typeof SAF?.getInfoAsync === 'function') {
      const info = await SAF.getInfoAsync(fileUri);
      if (info) return { size: info?.size ?? 0, mtime: normalizeMtime(info?.lastModified ?? info?.modificationTime) };
    }
  } catch {
    // fall through
  }
  try {
    const info: any = await LegacyFS.getInfoAsync(fileUri);
    if (info?.exists === false) return { size: 0, mtime: null };
    return { size: info?.size ?? 0, mtime: normalizeMtime(info?.modificationTime) };
  } catch {
    return { size: 0, mtime: null };
  }
}

/**
 * BUG FIX: sourceLabel used to be `depth === 0 ? 'WhatsApp' : 'WhatsApp'` —
 * both branches returned the same value, so every SAF-picked file was always
 * labeled "WhatsApp" even when the user picked the WhatsApp Business or a
 * mod's (.Statuses) folder. Derive the real label once per granted directory
 * and thread it through the recursion instead.
 */
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

        // Recurse into subdirectories (user may have picked Media/WhatsApp
        // instead of .Statuses because the picker hides dot-folders).
        if (depth < MAX_DEPTH && !classify(fileName)) {
          if (await isSAFDirectory(entryUri)) {
            const nested = await listSAFDirectory(entryUri, filter, depth + 1, label);
            files.push(...nested);
            continue;
          }
          // Not a media file and not a readable dir — skip.
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
        continue; // skip unreadable entries
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
        // One dead grant (revoked folder, deleted path) must not kill the
        // other grants.
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

// ─── Diagnostics ─────────────────────────────────────────────────────────────
// Answers "I picked the right folder — why is the grid empty?" with ground
// truth instead of guesses. Run on demand from Settings → Diagnostics.
export interface DirectProbe {
  path: string;
  label: string;
  exists: boolean;
  entries: number;
  media: number;
  error?: string;
}

export interface SAFProbe {
  /** Raw granted URI (truncated for display by callers). */
  uri: string;
  /** Human-readable form of the granted folder, e.g. "…/WhatsApp/Media/.Statuses". */
  folder: string;
  entries: number;
  files: number;
  samples: string[];
  error?: string;
}

export interface AccessDiagnosis {
  directAccess: boolean;
  directProbes: DirectProbe[];
  safGrants: SAFProbe[];
  totalImages: number;
  totalVideos: number;
}

/** Best-effort decode of an SAF tree/document URI into a readable path. */
export function decodeSAFUri(uri: string): string {
  try {
    const last = uri.split('/').pop() || uri;
    let decoded: string;
    try {
      decoded = decodeURIComponent(last);
    } catch {
      decoded = last;
    }
    // "primary:Android/media/…/.Statuses" or "tree/primary:…"
    const afterColon = decoded.includes(':')
      ? decoded.slice(decoded.lastIndexOf(':') + 1)
      : decoded;
    return afterColon || decoded;
  } catch {
    return uri;
  }
}

export async function diagnoseAccess(): Promise<AccessDiagnosis> {
  const directProbes: DirectProbe[] = [];
  for (const { path, label } of STATUS_PATHS) {
    try {
      const clean = path.replace(/^file:\/\//, '');
      const dir = new Directory(`file://${encodeURI(clean)}`);
      if (!dir.exists) {
        directProbes.push({ path, label, exists: false, entries: 0, media: 0 });
        continue;
      }
      try {
        const items = dir.list();
        let media = 0;
        for (const it of items) {
          if (!(it instanceof File)) continue;
          if (isIgnored(it.name)) continue;
          if (classify(it.name)) media++;
        }
        directProbes.push({ path, label, exists: true, entries: items.length, media });
      } catch (e: any) {
        directProbes.push({ path, label, exists: true, entries: 0, media: 0, error: 'listed but not readable (permission denied?)' });
      }
    } catch (e: any) {
      directProbes.push({ path, label, exists: false, entries: 0, media: 0, error: e?.message ?? 'probe failed' });
    }
  }

  const safGrants: SAFProbe[] = [];
  try {
    const SAF = (LegacyFS as any)?.StorageAccessFramework;
    const permissions: any[] = SAF?.getUriPermissionsAsync ? await SAF.getUriPermissionsAsync() : [];
    for (const p of Array.isArray(permissions) ? permissions : []) {
      const dirUri: string | undefined = p.directoryUri || p.uri;
      if (!dirUri) continue;
      const folder = decodeSAFUri(dirUri);
      try {
        const entries: string[] = await SAF.readDirectoryAsync(dirUri);
        const samples = (entries || []).slice(0, 5).map((e) => {
          try {
            return extractSAFFileName(e) || decodeSAFUri(e);
          } catch {
            return '(unreadable entry)';
          }
        });
        let files = 0;
        try {
          files = (await listSAFDirectory(dirUri, undefined)).length;
        } catch {
          files = 0;
        }
        safGrants.push({ uri: dirUri, folder, entries: (entries || []).length, files, samples });
      } catch (e: any) {
        safGrants.push({ uri: dirUri, folder, entries: 0, files: 0, samples: [], error: e?.message ?? 'could not read granted folder' });
      }
    }
  } catch {
    // SAF unavailable — grants list stays empty
  }

  let totalImages = 0;
  let totalVideos = 0;
  try {
    totalImages = (await listStatuses('image')).length;
  } catch {
    totalImages = 0;
  }
  try {
    totalVideos = (await listStatuses('video')).length;
  } catch {
    totalVideos = 0;
  }

  let directAccess = false;
  try {
    const { hasStoragePermission } = await import('./storageAccess');
    directAccess = await hasStoragePermission();
  } catch {
    directAccess = false;
  }

  return { directAccess, directProbes, safGrants, totalImages, totalVideos };
}

// ─── File preparation (copy to cache so MediaLibrary / Sharing can use it) ───
// content:// (SAF) URIs can't be displayed by <Image>, decoded by
// expo-video-thumbnails, or played by expo-video reliably. Staging them to a
// file:// cache path first fixes black cells / blank previews.
export function isContentUri(uri: string): boolean {
  return typeof uri === 'string' && uri.startsWith('content://');
}

const stagedCache = new Map<string, string>();

/**
 * Copy a content:// URI to app cache once per uri; file:// passes through.
 * The destination name is deterministic (hash + safe name) so re-staging the
 * same status overwrites instead of leaking a new file every time, and
 * best-effort pruning keeps the preview cache from growing forever.
 */
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

/** Keep only the newest `keep` files in a cache dir — never let staging grow unbounded. */
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
        // best effort
      }
    }
  } catch {
    // best effort
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
  // Always stage through our cache: isolates the save/share from WhatsApp
  // deleting the source file mid-operation, and converts SAF content:// URIs
  // (which MediaLibrary/Sharing can't consume directly) into file:// paths.
  // LegacyFS.copyAsync supports file://, content:// and SAF URIs as source.
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
    // temp-file cleanup must never fail the save/share itself
  }
}

// ─── Save to gallery ─────────────────────────────────────────────────────────
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
      // asset is still saved even if album creation fails on some OEMs
    }
  } finally {
    await deleteSilent(local);
  }
}

export async function saveMultipleToGallery(files: StatusFile[]): Promise<{ saved: number; errors: number }> {
  // Request once up-front so a bulk save can't spam the system dialog per file.
  try {
    const perm = await MediaLibrary.getPermissionsAsync();
    if (!perm.granted) {
      const req = await MediaLibrary.requestPermissionsAsync();
      if (!req.granted) return { saved: 0, errors: files.length };
    }
  } catch {
    return { saved: 0, errors: files.length };
  }
  let saved = 0, errors = 0;
  for (const f of files) {
    try {
      const local = await prepareFile(f.uri, f.name);
      try {
        const asset = await MediaLibrary.createAssetAsync(local);
        try {
          const album = await MediaLibrary.getAlbumAsync('Status Saver');
          if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          else await MediaLibrary.createAlbumAsync('Status Saver', asset, false);
        } catch {
          // asset saved even if album step fails
        }
        saved++;
      } finally {
        await deleteSilent(local);
      }
    }
    catch { errors++; }
  }
  return { saved, errors };
}

// ─── Share ────────────────────────────────────────────────────────────────────
export async function shareFile(fileUri: string, fileName: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing not available on this device');
  const local = await prepareFile(fileUri, fileName);
  try {
    await Sharing.shareAsync(local, { dialogTitle: 'Share Status' });
  } finally {
    await deleteSilent(local);
  }
}

export async function shareToWhatsApp(fileUri: string, fileName: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing not available on this device');
  const local = await prepareFile(fileUri, fileName);
  try {
    const mimeType = /\.(mp4|mkv|avi|mov|3gp)$/i.test(fileName) ? 'video/*' : 'image/*';
    await Sharing.shareAsync(local, { dialogTitle: 'Share to WhatsApp', mimeType });
  } finally {
    await deleteSilent(local);
  }
}
