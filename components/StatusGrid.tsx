import React, { memo, useEffect, useState } from "react";
import {
  View,
  FlatList,
  Pressable,
  Image,
  Text,
  StyleSheet,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as VideoThumbnails from "expo-video-thumbnails";
import { THEME } from "../constants/theme";
import type { StatusFile } from "../lib/statusService";
import { formatBytes, formatDate, ensureLocalUri, isContentUri } from "../lib/statusService";

const GAP = 3;
const COLS = 3;
const SCREEN_W = Dimensions.get("window").width;
const ITEM = (SCREEN_W - GAP * (COLS + 1)) / COLS;

type Props = {
  data: StatusFile[];
  onPress: (f: StatusFile) => void;
  onLongPress?: (f: StatusFile) => void;
  emptyText: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (f: StatusFile) => void;
  selectionMode?: boolean;
  /** Extra actions (e.g. re-pick folder) shown under the empty state. */
  emptyAction?: React.ReactNode;
};

function Skeleton() {
  return (
    <View style={s.skeletonWrap}>
      {Array.from({ length: 12 }).map((_, i) => (
        <View key={i} style={s.skeletonCell}>
          <View style={s.skeletonShimmer} />
        </View>
      ))}
    </View>
  );
}

const GridItem = memo(function GridItem({
  item,
  onPress,
  onLongPress,
  onToggleSelect,
  isSelected,
  selectionMode,
}: {
  item: StatusFile;
  onPress: (f: StatusFile) => void;
  onLongPress?: (f: StatusFile) => void;
  onToggleSelect?: (f: StatusFile) => void;
  isSelected?: boolean;
  selectionMode?: boolean;
}) {
  const isVideo = item.type === "video";
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [stagedImageUri, setStagedImageUri] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  // Generate a real thumbnail for videos (expo-image can't decode video
  // frames, so without this every video cell renders black).
  // Try the URI directly first — copying every video to cache just for a
  // thumbnail would be slow and could fill storage. Only stage SAF
  // content:// URIs to file:// if the thumbnailer can't read them.
  useEffect(() => {
    let cancelled = false;
    if (!isVideo) {
      setThumbUri(null);
      return;
    }
    setThumbUri(null);
    (async () => {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(item.uri, { time: 500, quality: 0.6 });
        if (!cancelled) {
          setThumbUri(uri);
          return;
        }
      } catch {
        // fall through to staged retry for content:// URIs
      }
      if (!isContentUri(item.uri)) {
        if (!cancelled) setThumbUri(null);
        return;
      }
      try {
        const staged = await ensureLocalUri(item.uri, item.name);
        const { uri } = await VideoThumbnails.getThumbnailAsync(staged, { time: 500, quality: 0.6 });
        if (!cancelled) setThumbUri(uri);
      } catch {
        if (!cancelled) setThumbUri(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isVideo, item.uri, item.name]);

  // Reset staged-image state when the cell is recycled for another file.
  useEffect(() => {
    setStagedImageUri(null);
    setImgFailed(false);
  }, [item.uri]);

  // Stage SAF images to cache if the raw content:// URI fails to render.
  async function handleImageError() {
    if (!isContentUri(item.uri) || stagedImageUri) {
      setImgFailed(true);
      return;
    }
    try {
      const local = await ensureLocalUri(item.uri, item.name);
      setStagedImageUri(local);
    } catch {
      setImgFailed(true);
    }
  }

  // NOTE: the checkbox is a SIBLING of the cell pressable (not a child).
  // A nested Pressable would also fire the parent's onPress, opening the
  // preview every time the user taps ✓.
  return (
    <View style={[s.cell, isSelected && s.cellSelected]}>
      <Pressable
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress?.(item)}
        delayLongPress={280}
        style={({ pressed }) => [s.cellPress, pressed && { opacity: 0.85 }]}
      >
        {isVideo && !thumbUri ? (
          <View style={s.thumbFallback}>
            <ActivityIndicator size="small" color={THEME.colors.textMuted} />
          </View>
        ) : imgFailed ? (
          <View style={s.thumbFallback}>
            <Ionicons
              name={isVideo ? "videocam-outline" : "image-outline"}
              size={28}
              color="#8A9BA3"
            />
          </View>
        ) : (
          <Image
            source={{ uri: isVideo ? thumbUri ?? stagedImageUri ?? item.uri : stagedImageUri ?? item.uri }}
            style={s.thumb}
            resizeMode="cover"
            onError={handleImageError}
          />
        )}
        {isVideo && <View style={s.videoScrim} />}
        {/* Top source chip */}
        <View style={s.topChip} pointerEvents="none">
          <Text style={s.topChipText} numberOfLines={1}>
            {(item.sourceLabel || 'WhatsApp').replace(" (Granted)", "")}
          </Text>
        </View>

        {/* Center play */}
        {isVideo && (
          <View style={s.playWrap} pointerEvents="none">
            <View style={s.playCircle}>
              <Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
            </View>
          </View>
        )}

        {/* Bottom gradient info */}
        <View style={s.bottomGrad} pointerEvents="none">
          <Text style={s.nameText} numberOfLines={1}>
            {formatDate(item.mtime)}
          </Text>
          <Text style={s.sizeText} numberOfLines={1}>
            {formatBytes(item.size)}
          </Text>
        </View>
      </Pressable>

      {/* Selection checkbox — tapping it toggles multi-select without
          opening the preview. The cell itself always opens the preview. */}
      <Pressable
        onPress={() => (onToggleSelect ?? onLongPress)?.(item)}
        hitSlop={12}
        style={[s.checkCircle, isSelected ? s.checkCircleActive : s.checkCircleIdle]}
      >
        {isSelected ? <Ionicons name="checkmark" size={14} color="#fff" /> : <View style={s.checkInner} />}
      </Pressable>
    </View>
  );
});

export function StatusGrid({
  data,
  onPress,
  onLongPress,
  emptyText,
  refreshing,
  onRefresh,
  selectedIds,
  onToggleSelect,
  selectionMode,
  emptyAction,
}: Props) {
  if (data.length === 0 && !refreshing) {
    const emptyBody = (
      <View style={s.empty}>
        <View style={s.emptyIconWrap}>
          <Ionicons name="images-outline" size={44} color={THEME.colors.primary} />
        </View>
        <Text style={s.emptyTitle}>No statuses yet</Text>
        <Text style={s.emptySub}>{emptyText}</Text>
        <View style={s.emptySteps}>
          <View style={s.stepRow}>
            <View style={s.stepNum}><Text style={s.stepNumText}>1</Text></View>
            <Text style={s.stepText}>Open WhatsApp or WhatsApp Business</Text>
          </View>
          <View style={s.stepRow}>
            <View style={s.stepNum}><Text style={s.stepNumText}>2</Text></View>
            <Text style={s.stepText}>View any status you want to save</Text>
          </View>
          <View style={s.stepRow}>
            <View style={s.stepNum}><Text style={s.stepNumText}>3</Text></View>
            <Text style={s.stepText}>Return here & pull to refresh</Text>
          </View>
        </View>
        {emptyAction ? <View style={s.emptyActionWrap}>{emptyAction}</View> : null}
      </View>
    );
    // Wrap in a scrollable so pull-to-refresh works even with no results
    if (onRefresh) {
      return (
        <FlatList
          data={[]}
          renderItem={null as any}
          ListEmptyComponent={emptyBody}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              colors={[THEME.colors.primary]}
              tintColor={THEME.colors.primary}
            />
          }
        />
      );
    }
    return emptyBody;
  }

  // Tap ALWAYS opens the fullscreen preview (with Download/Share).
  // Multi-select is via long-press or the ✓ checkbox — never by tapping.
  const handlePress = (f: StatusFile) => {
    onPress(f);
  };
  const handleLong = (f: StatusFile) => {
    if (onLongPress) onLongPress(f);
    else if (onToggleSelect) onToggleSelect(f);
  };

  return (
    <FlatList
      data={data}
      keyExtractor={(i) => i.uri}
      numColumns={COLS}
      contentContainerStyle={{ padding: GAP, paddingBottom: 28, gap: GAP }}
      columnWrapperStyle={{ gap: GAP }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[THEME.colors.primary]} tintColor={THEME.colors.primary} /> : undefined
      }
      renderItem={({ item }) => (
        <GridItem
          item={item}
          onPress={handlePress}
          onLongPress={handleLong}
          onToggleSelect={onToggleSelect}
          isSelected={selectedIds?.has(item.uri)}
          selectionMode={selectionMode}
        />
      )}
      ListFooterComponent={
        data.length > 0 ? (
          <View style={s.footer}>
            <Text style={s.footerText}>
              {data.length} {data.length === 1 ? "status" : "statuses"} • Pull to refresh
            </Text>
          </View>
        ) : null
      }
    />
  );
}

export function StatusGridSkeleton() {
  return <Skeleton />;
}

const s = StyleSheet.create({
  cell: {
    width: ITEM,
    height: ITEM,
    backgroundColor: "#E9EDEF",
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9EDEF",
  },
  cellPress: {
    width: "100%",
    height: "100%",
  },
  cellSelected: {
    borderColor: THEME.colors.primary,
    borderWidth: 2.5,
  },
  thumb: { width: "100%", height: "100%", backgroundColor: "#DDE3E6" } as any,
  thumbFallback: { width: "100%", height: "100%", backgroundColor: "#1E2A30", alignItems: "center", justifyContent: "center" } as any,
  videoScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.08)" } as any,
  topChip: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(17,27,33,0.62)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: ITEM - 22,
  },
  topChipText: { color: "#fff", fontSize: 9, fontWeight: "700", letterSpacing: 0.2 },
  playWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" } as any,
  playCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.85)",
  },
  bottomGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 7,
    paddingTop: 18,
    paddingBottom: 6,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  nameText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  sizeText: { color: "rgba(255,255,255,0.85)", fontSize: 9, marginTop: 1 },
  checkCircle: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.4,
  },
  checkCircleIdle: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderColor: "rgba(0,0,0,0.12)",
  },
  checkCircleActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  checkInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.08)" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, paddingTop: 46, gap: 10 },
  emptyIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#E7F8EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#D0F0D8",
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: THEME.colors.text, letterSpacing: -0.2 },
  emptySub: { fontSize: 13.5, color: THEME.colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: 8 },
  emptySteps: { marginTop: 14, gap: 10, width: "100%", maxWidth: 320 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.border },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: THEME.colors.primary, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  stepText: { flex: 1, color: THEME.colors.text, fontSize: 13, fontWeight: "600" },
  emptyActionWrap: { marginTop: 6, width: "100%", maxWidth: 320, gap: 8 },
  footer: { alignItems: "center", paddingTop: 14, paddingBottom: 6 },
  footerText: { fontSize: 11.5, color: THEME.colors.textMuted, fontWeight: "600" },
  skeletonWrap: { flexDirection: "row", flexWrap: "wrap", gap: GAP, padding: GAP },
  skeletonCell: { width: ITEM, height: ITEM, borderRadius: 12, backgroundColor: "#E9EDEF", overflow: "hidden" },
  skeletonShimmer: { flex: 1, backgroundColor: "#F0F2F5" },
});
