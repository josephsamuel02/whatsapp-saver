import { Platform } from "react-native";
import { Directory, File } from "expo-file-system";
import * as LegacyFS from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

// ─── Types ────────────────────────────────────────────────────────────────────
export type MediaType = "image" | "video";
export interface StatusFile {
  uri: string;
  name: string;
  type: MediaType;
  mtime: number | null;
  size: number;
  source: string; // raw dir path or SAF uri
  sourceLabel: string; // human label: WhatsApp, GBWhatsApp, etc
  isSAF: boolean;
}

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const VIDEO_EXT = new Set([".mp4", ".3gp", ".mkv", ".mov", ".webm", ".avi"]);

function classify(name: string): MediaType | null {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  return null;
}
function isIgnored(name: string) {
  return name === ".nomedia" || name === ".thumbs" || name.startsWith(".");
}

function labelFromPath(p: string): string {
  const low = p.toLowerCase();
  if (low.includes("whatsapp business") || low.includes("com.whatsapp.w4b")) return "WhatsApp Business";
  if (low.includes("gbwhatsapp") || low.includes("com.gb")) return "GBWhatsApp";
  if (low.includes("yowa") || low.includes("yowhatsapp")) return "YoWhatsApp";
  if (low.includes("fmwhatsapp") || low.includes("com.fm")) return "FMWhatsApp";
  if (low.includes("ogwhatsapp")) return "OGWhatsApp";
  if (low.includes("whatsapp plus") || low.includes("plus")) return "WhatsApp Plus";
  if (low.includes("aero")) return "Aero WhatsApp";
  if (low.includes("mbwhatsapp") || low.includes("mb whatsapp")) return "MBWhatsApp";
  if (low.includes("ns whatsapp") || low.includes("nswhatsapp")) return "NSWhatsApp";
  if (low.includes("whatsapp")) return "WhatsApp";
  return "WhatsApp";
}

// ─── Prioritized status locations ─────────────────────────────────────────
// Prioritized to canonical Android paths first for instant permission + fast scan.
// Covers both .Statuses and Statuses, WhatsApp + WhatsApp Business, legacy + scoped.
function buildStatusDirs(): string[] {
  const bases = ["/storage/emulated/0", "/sdcard"];
  const statusNames = [".Statuses", "Statuses"];

  const dirs: string[] = [];

  function add(p: string) {
    if (!dirs.includes(p)) dirs.push(p);
  }

  for (const base of bases) {
    for (const s of statusNames) {
      // WhatsApp - official canonical (Android 10+ scoped)
      add(`${base}/Android/media/com.whatsapp/WhatsApp/Media/${s}`);
      // WhatsApp Business - official canonical (Android 10+ scoped)
      add(`${base}/Android/media/com.whatsapp.w4b/WhatsApp Business/Media/${s}`);
      // Legacy (older WhatsApp installations)
      add(`${base}/WhatsApp/Media/${s}`);
      add(`${base}/WhatsApp Business/Media/${s}`);
    }
  }

  // Also include mod variants (GB/Yo/FM) but after official so official is checked first
  const mods: Array<{ folder: string; pkg: string }> = [
    { folder: "GBWhatsApp", pkg: "com.gbwhatsapp" },
    { folder: "YoWhatsApp", pkg: "com.yowa" },
    { folder: "FMWhatsApp", pkg: "com.fmwhatsapp" },
  ];
  for (const base of bases) {
    for (const m of mods) {
      for (const s of statusNames) {
        add(`${base}/${m.folder}/Media/${s}`);
        add(`${base}/Android/media/${m.pkg}/${m.folder}/Media/${s}`);
        add(`${base}/Android/media/${m.pkg}/Media/${s}`);
      }
    }
  }

  // Temporary cache locations where WhatsApp buffers viewed statuses before moving
  for (const base of bases) {
    add(`${base}/Android/data/com.whatsapp/cache`);
    add(`${base}/Android/data/com.whatsapp.w4b/cache`);
  }

  return dirs;
}

export const STATUS_DIRS: string[] = buildStatusDirs();

// ─── Direct-filesystem scanner (legacy + MANAGE_EXTERNAL_STORAGE) ────────────
function toFileUri(p: string): string {
  if (p.startsWith("file://") || p.startsWith("content://")) return p;
  return `file://${p}`;
}
function scanStatusDirSync(dirPath: string, filter?: MediaType): StatusFile[] {
  // Try both raw and file:// prefixed - Directory expects file:// for external storage
  for (const candidate of [dirPath, toFileUri(dirPath)]) {
    try {
      const dir = new Directory(candidate);
      if (!dir.exists) continue;
      const items = dir.list();
      const out: StatusFile[] = [];
      for (const it of items) {
        if (!(it instanceof File)) continue;
        const name = it.name;
        if (isIgnored(name)) continue;
        const t = classify(name);
        if (!t) continue;
        if (filter && t !== filter) continue;
        out.push({
          uri: (it as any).uri || `${candidate}/${name}`,
          name,
          type: t,
          mtime: (it as any).modificationTime ?? null,
          size: (it as any).size ?? 0,
          source: dirPath,
          sourceLabel: labelFromPath(dirPath),
          isSAF: false,
        });
      }
      if (out.length > 0) {
        out.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
        return out;
      }
    } catch { /* try next candidate */ }
  }
  return [];
}

async function scanStatusDirAsync(dirPath: string, filter?: MediaType): Promise<StatusFile[]> {
  const uri = toFileUri(dirPath);
  // Primary: LegacyFS readDirectoryAsync - works with MANAGE_EXTERNAL_STORAGE and file:// uris
  try {
    const names: string[] = await (LegacyFS as any).readDirectoryAsync(uri);
    if (Array.isArray(names) && names.length >= 0) {
      const out: StatusFile[] = [];
      for (const name of names) {
        if (isIgnored(name)) continue;
        const t = classify(name);
        if (!t) continue;
        if (filter && t !== filter) continue;
        const fullUri = `${uri}/${name}`;
        let size = 0; let mtime: number | null = null;
        try {
          const info: any = await (LegacyFS as any).getInfoAsync(fullUri);
          if (info?.exists === false) continue;
          size = info?.size ?? 0;
          mtime = info?.modificationTime ?? null;
        } catch {}
        out.push({ uri: fullUri, name, type: t, mtime, size, source: dirPath, sourceLabel: labelFromPath(dirPath), isSAF: false });
      }
      if (out.length > 0) {
        out.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
        return out;
      }
    }
  } catch {}
  // Fallback to sync Directory scan
  return scanStatusDirSync(dirPath, filter);
}

// ─── SAF scanner ──────────────────────────────────────────────────────────────
async function scanSafDir(safUri: string, filter?: MediaType): Promise<StatusFile[]> {
  try {
    const SAF: any = (LegacyFS as any).StorageAccessFramework;
    if (!SAF?.readDirectoryAsync) return [];
    const children: string[] = await SAF.readDirectoryAsync(safUri);
    const out: StatusFile[] = [];
    for (const childUri of children) {
      let raw = childUri.split("/").pop() || childUri;
      try { raw = decodeURIComponent(raw); } catch {}
      let name = raw;
      if (raw.includes(":")) {
        const parts = raw.split(":");
        name = parts[parts.length - 1]!.split("/").pop() || raw;
      }
      if (name.includes("/")) name = name.split("/").pop() || name;

      if (isIgnored(name)) continue;
      const t = classify(name);
      if (!t) continue;
      if (filter && t !== filter) continue;

      let mtime: number | null = null;
      let size = 0;
      try {
        const info: any = await (LegacyFS as any).getInfoAsync(childUri);
        size = info.size ?? 0;
        mtime = (info as any).modificationTime ?? null;
      } catch {}
      if (mtime == null && SAF.getInfoAsync) {
        try {
          const inf = await SAF.getInfoAsync(childUri);
          size = (inf as any).size ?? size;
          mtime = (inf as any).lastModified ?? mtime;
        } catch {}
      }

      out.push({
        uri: childUri,
        name,
        type: t,
        mtime,
        size,
        source: safUri,
        sourceLabel: labelFromPath(safUri) + " (Granted)",
        isSAF: true,
      });
    }
    out.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
    return out;
  } catch {
    return [];
  }
}

async function listViaSAF(filter?: MediaType): Promise<StatusFile[]> {
  const SAF: any = (LegacyFS as any).StorageAccessFramework;
  if (Platform.OS !== "android" || !SAF?.getPersistedUriPermissionsAsync) return [];
  try {
    const persisted: Array<{ directoryUri: string } & any> = await SAF.getPersistedUriPermissionsAsync();
    if (!persisted || persisted.length === 0) return [];
    const all: StatusFile[] = [];
    for (const p of persisted) {
      const uri = (p as any).directoryUri || (p as any).uri || (p as any);
      if (typeof uri !== "string") continue;
      const part = await scanSafDir(uri, filter);
      all.push(...part);
      try {
        const children: string[] = await SAF.readDirectoryAsync(uri);
        for (const c of children) {
          const dec = decodeURIComponent(c as any);
          if (dec.toLowerCase().includes(".statuses")) {
            const sub = await scanSafDir(c as any, filter);
            all.push(...sub);
          }
        }
      } catch {}
    }
    return all;
  } catch { return []; }
}

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Async unified scanner - tries direct filesystem first, then SAF persisted grants.
 * Dedupes by file name + size + uri.
 */
export async function listStatusesAsync(filter?: MediaType): Promise<StatusFile[]> {
  if (Platform.OS !== "android") return [];
  const direct: StatusFile[] = [];
  const seen = new Set<string>();

  // Direct scan - parallel for speed
  const directBatches = await Promise.all(STATUS_DIRS.map((p) => scanStatusDirAsync(p, filter)));
  for (const files of directBatches) {
    for (const f of files) {
      const key = `${f.name}::${f.size}`;
      if (seen.has(f.uri) || seen.has(key)) continue;
      seen.add(f.uri);
      seen.add(key);
      direct.push(f);
    }
  }

  const saf = await listViaSAF(filter);
  for (const f of saf) {
    const key = `${f.name}::${f.size}`;
    if (seen.has(f.uri) || seen.has(key)) continue;
    seen.add(f.uri);
    seen.add(key);
    direct.push(f);
  }

  direct.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
  return direct;
}

/** Synchronous fallback - direct only (useful for instant render) */
export function listStatuses(filter?: MediaType): StatusFile[] {
  if (Platform.OS !== "android") return [];
  const out: StatusFile[] = [];
  const seen = new Set<string>();
  for (const p of STATUS_DIRS) {
    const dirFiles = scanStatusDirSync(p, filter);
    for (const f of dirFiles) {
      if (seen.has(f.uri)) continue;
      seen.add(f.uri);
      out.push(f);
    }
  }
  out.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
  return out;
}

export async function getStatusDirStatus(): Promise<Array<{ path: string; exists: boolean; count: number }>> {
  if (Platform.OS !== "android") return [];
  const res: Array<{ path: string; exists: boolean; count: number }> = [];
  const sample = STATUS_DIRS.filter((p) => !p.endsWith("/received") && !p.endsWith("/sent")).slice(0, 24);
  for (const p of sample) {
    try {
      const uri = toFileUri(p);
      try {
        const names: string[] = await (LegacyFS as any).readDirectoryAsync(uri);
        const count = names.filter((n: string) => !isIgnored(n) && classify(n)).length;
        res.push({ path: p, exists: true, count });
        continue;
      } catch {}
      const d = new Directory(uri);
      const exists = d.exists;
      const count = exists ? d.list().filter((i) => i instanceof File && !isIgnored(i.name) && classify(i.name)).length : 0;
      res.push({ path: p, exists, count });
    } catch {
      res.push({ path: p, exists: false, count: 0 });
    }
  }
  return res;
}

export function getStatusDirUri(): string | null {
  if (Platform.OS !== "android") return null;
  for (const p of STATUS_DIRS) {
    for (const c of [p, toFileUri(p)]) {
      try { if (new Directory(c).exists) return p; } catch {}
    }
  }
  return null;
}

// ─── SAF helpers ──────────────────────────────────────────────────────────────
export async function hasSAFGrant(): Promise<boolean> {
  const SAF: any = (LegacyFS as any).StorageAccessFramework;
  if (!SAF?.getPersistedUriPermissionsAsync) return false;
  try {
    const list = await SAF.getPersistedUriPermissionsAsync();
    return Array.isArray(list) && list.length > 0;
  } catch { return false; }
}

export async function requestSAFPermission(): Promise<boolean> {
  const SAF: any = (LegacyFS as any).StorageAccessFramework;
  if (!SAF?.requestDirectoryPermissionsAsync) throw new Error("StorageAccessFramework not available on this device");
  const res = await SAF.requestDirectoryPermissionsAsync();
  return !!res?.granted;
}

// Copy a SAF content:// uri or file:// uri to a cache file usable by MediaLibrary/share
async function ensureCacheFile(uri: string, name: string): Promise<string> {
  if (uri.startsWith("file://")) return uri;
  const cacheBase = (LegacyFS as any).cacheDirectory || (LegacyFS as any).documentDirectory || "file:///tmp/";
  const cacheDir = cacheBase + "status_saver/";
  try { await (LegacyFS as any).makeDirectoryAsync(cacheDir, { intermediates: true }); } catch {}
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dest = `${cacheDir}${Date.now()}_${safeName}`;

  try {
    await (LegacyFS as any).copyAsync({ from: uri, to: dest });
    const info: any = await (LegacyFS as any).getInfoAsync(dest);
    if (info.exists) return dest;
  } catch {}

  const SAF: any = (LegacyFS as any).StorageAccessFramework;
  try {
    if (SAF?.readAsStringAsync) {
      const b64 = await SAF.readAsStringAsync(uri, { encoding: (LegacyFS as any).EncodingType?.Base64 ?? "base64" });
      await (LegacyFS as any).writeAsStringAsync(dest, b64, { encoding: (LegacyFS as any).EncodingType?.Base64 ?? "base64" });
      return dest;
    }
  } catch {}
  throw new Error("Could not prepare file for sharing/saving");
}

// ─── Save / Share ─────────────────────────────────────────────────────────────
export async function saveToGallery(file: StatusFile | string): Promise<string> {
  const uri = typeof file === "string" ? file : file.uri;
  const name = typeof file === "string" ? uri.split("/").pop() || "status.jpg" : file.name;

  const perm = await MediaLibrary.requestPermissionsAsync(true as any);
  if (!perm.granted) throw new Error("Gallery permission denied. Please allow photos access in Settings.");

  const fileUri = await ensureCacheFile(uri, name);
  const asset = await MediaLibrary.createAssetAsync(fileUri);
  try {
    const album = await MediaLibrary.getAlbumAsync("Status Saver");
    if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    else await MediaLibrary.createAlbumAsync("Status Saver", asset, false);
  } catch {
    // Album creation can fail on some OEMs but asset is still saved to gallery
  }
  return asset.uri;
}

export async function saveMultipleToGallery(files: StatusFile[]): Promise<{ saved: number; errors: number }> {
  let saved = 0; let errors = 0;
  for (const f of files) {
    try { await saveToGallery(f); saved++; } catch { errors++; }
  }
  return { saved, errors };
}

export async function shareFile(file: StatusFile | string): Promise<void> {
  const uri = typeof file === "string" ? file : file.uri;
  const name = typeof file === "string" ? uri.split("/").pop() || "status" : file.name;
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing not available on this device");
  const localUri = await ensureCacheFile(uri, name);
  await Sharing.shareAsync(localUri, { dialogTitle: "Share status" });
}

export async function shareToWhatsApp(file: StatusFile | string): Promise<void> {
  const uri = typeof file === "string" ? file : file.uri;
  const name = typeof file === "string" ? uri.split("/").pop() || "status" : file.name;
  const localUri = await ensureCacheFile(uri, name);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing not available");
  // Opens system chooser - user picks WhatsApp; direct package targeting via intent not exposed by expo-sharing,
  // but chooser is most reliable across OEMs and avoids missing-activity crashes.
  const mime = name.toLowerCase().endsWith(".mp4") || name.toLowerCase().endsWith(".mov") ? "video/*" : "image/*";
  await Sharing.shareAsync(localUri, { mimeType: mime, dialogTitle: "Share to WhatsApp" });
}

// ─── Formatting helpers ───────────────────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024; const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1))} ${sizes[i]}`;
}
export function formatDate(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
