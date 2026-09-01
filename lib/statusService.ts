import { Platform } from "react-native";
import { Directory, File } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

// ─── WhatsApp .Statuses locations ────────────────────────────────────────────
// Android 11+ scoped storage + legacy paths + both WhatsApp and WhatsApp Business
export const STATUS_DIRS = [
  "/storage/emulated/0/WhatsApp/Media/.Statuses",
  "/storage/emulated/0/WhatsApp Business/Media/.Statuses",
  "/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/.Statuses",
  "/storage/emulated/0/Android/media/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses",
  "/storage/emulated/0/Android/data/com.whatsapp/Media/.Statuses",
  "/storage/emulated/0/Android/data/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses",
  "/storage/emulated/0/WhatsApp/Media/.Statuses/received",
  "/storage/emulated/0/WhatsApp Business/Media/.Statuses/received",
  "/sdcard/WhatsApp/Media/.Statuses",
  "/sdcard/WhatsApp Business/Media/.Statuses",
  "/sdcard/Android/media/com.whatsapp/WhatsApp/Media/.Statuses",
  "/sdcard/Android/media/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses",
  "/sdcard/Android/data/com.whatsapp/Media/.Statuses",
  "/sdcard/Android/data/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses",
] as const;

function scanStatusDir(dirPath: string, filter?: MediaType): StatusFile[] {
  try {
    const dir = new Directory(dirPath);
    if (!dir.exists) return [];

    const items = dir.list();
    const out: StatusFile[] = [];

    for (const it of items) {
      if (!(it instanceof File)) continue;
      if (isIgnored(it.name)) continue;

      const t = classify(it.name);
      if (!t) continue;
      if (filter && t !== filter) continue;

      out.push({
        uri: it.uri,
        name: it.name,
        type: t,
        mtime: it.modificationTime,
        size: it.size ?? 0,
      });
    }

    out.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
    return out;
  } catch {
    return [];
  }
}

export type MediaType = "image" | "video";
export interface StatusFile {
  uri: string;
  name: string;
  type: MediaType;
  mtime: number | null;
  size: number;
}

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const VIDEO_EXT = new Set([".mp4", ".3gp", ".mkv", ".mov"]);

function classify(name: string): MediaType | null {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  return null;
}

function isIgnored(name: string) {
  return name === ".nomedia" || name.startsWith(".");
}

/**
 * List statuses from the first accessible .Statuses dir.
 * Returns empty on iOS or if permissions denied / dir not found.
 */
export function listStatuses(filter?: MediaType): StatusFile[] {
  if (Platform.OS !== "android") return [];

  const results: StatusFile[] = [];
  const seen = new Set<string>();

  for (const p of STATUS_DIRS) {
    const dirFiles = scanStatusDir(p, filter);
    for (const file of dirFiles) {
      if (seen.has(file.uri)) continue;
      seen.add(file.uri);
      results.push(file);
    }
  }

  results.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
  return results;
}

export function getStatusDirUri(): string | null {
  if (Platform.OS !== "android") return null;
  for (const p of STATUS_DIRS) {
    try {
      if (new Directory(p).exists) return p;
    } catch {}
  }
  return null;
}

/** Save a status file to gallery via MediaLibrary. Creates "Status Saver" album. */
export async function saveToGallery(fileUri: string): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) throw new Error("Media library permission denied");

  // MediaLibrary needs a local file — copy to cache first if needed
  const asset = await MediaLibrary.createAssetAsync(fileUri);
  const album = await MediaLibrary.getAlbumAsync("Status Saver");
  if (album) {
    await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
  } else {
    await MediaLibrary.createAlbumAsync("Status Saver", asset, false);
  }
}

export async function shareFile(fileUri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing not available");
  await Sharing.shareAsync(fileUri);
}

/** Share to WhatsApp directly using WhatsApp sharing URL scheme */
export async function shareToWhatsApp(fileUri: string): Promise<void> {
  if (Platform.OS !== "android") throw new Error("WhatsApp sharing is Android only");

  // For Android, we use the ContentProvider URI scheme
  // This allows sharing directly to WhatsApp contacts and groups
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error("Sharing not available");

  // shareAsync opens the system share sheet where user can select WhatsApp
  // This is the most reliable cross-platform method
  await Sharing.shareAsync(fileUri, {
    mimeType: "image/*", // Default to image, video will still work
    dialogTitle: "Share to WhatsApp",
  });
}
