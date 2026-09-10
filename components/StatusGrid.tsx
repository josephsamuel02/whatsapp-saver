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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as VideoThumbnails from "expo-video-thumbnails";
import { THEME } from "../constants/theme";
import type { StatusFile } from "../lib/statusService";
import { formatBytes, formatDate, ensureLocalUri, isContentUri, saveToGallery } from "../lib/statusService";

const GAP = 6;
const COLS = 3;
const SCREEN_W = Dimensions.get("window").width;
const ITEM = (SCREEN_W - GAP * (COLS + 1)) / COLS;

type Props = {
  data: StatusFile[];
  onPress: (f: StatusFile) => void;
  emptyText: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Extra actions (e.g. re-pick folder) shown under the empty state. */
  emptyAction?: React.ReactNode;
};

function Skeleton() {
  return (
    <View style={s.skeletonWrap}>
      {Array.from({ length: 6 }).map((_, i) => (
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
}: {
  item: StatusFile;
  onPress: (f: StatusFile) => void;
}) {
  const isVideo = item.type === "video";
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [stagedImageUri, setStagedImageUri] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isVideo) {
      setThumbUri(null);
      setThumbFailed(false);
      return;
    }
    setThumbUri(null);
    setThumbFailed(false);
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
        if (!cancelled) setThumbFailed(true);
        return;
      }
      try {
        const staged = await ensureLocalUri(item.uri, item.name);
        const { uri } = await VideoThumbnails.getThumbnailAsync(staged, { time: 500, quality: 0.6 });
        if (!cancelled) setThumbUri(uri);
      } catch {
        if (!cancelled) setThumbFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isVideo, item.uri, item.name]);

  useEffect(() => {
    setStagedImageUri(null);
    setImgFailed(false);
  }, [item.uri]);

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

  async function handleQuickSave() {
    if (saving || saved) return;
    setSaving(true);
    try {
      await saveToGallery(item.uri, item.name);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      Alert.alert("Could not save", e?.message ?? "Try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={s.cell}>
      <Pressable
        onPress={() => onPress(item)}
        style={({ pressed }) => [s.cellPress, pressed && { opacity: 0.85 }]}
      >
        {isVideo && !thumbUri && !thumbFailed ? (
          <View style={s.thumbFallback}>
            <ActivityIndicator size="small" color={THEME.colors.textMuted} />
          </View>
        ) : imgFailed || thumbFailed ? (
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
        <View style={s.topChip} pointerEvents="none">
          <Text style={s.topChipText} numberOfLines={1}>
            {(item.sourceLabel || 'WhatsApp').replace(" (Granted)", "")}
          </Text>
        </View>

        {isVideo && (
          <View style={s.playWrap} pointerEvents="none">
            <View style={s.playCircle}>
              <Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
            </View>
          </View>
        )}

        <View style={s.bottomGrad} pointerEvents="none">
          <Text style={s.nameText} numberOfLines={1}>
            {formatDate(item.mtime)}
          </Text>
          <Text style={s.sizeText} numberOfLines={1}>
            {formatBytes(item.size)}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={handleQuickSave}
        hitSlop={8}
        style={s.saveBtn}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name={saved ? "checkmark" : "download"} size={14} color="#fff" />
        )}
      </Pressable>
    </View>
  );
});

export function StatusGrid({
  data,
  onPress,
  emptyText,
  refreshing,
  onRefresh,
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
        {emptyAction ? <View style={s.emptyActionWrap}>{emptyAction}</View> : null}
      </View>
    );
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

  const handlePress = (f: StatusFile) => {
    onPress(f);
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
        />
      )}
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
  thumb: { width: "100%", height: "100%", backgroundColor: "#DDE3E6" } as any,
  thumbFallback: { width: "100%", height: "100%", backgroundColor: "#1E2A30", alignItems: "center", justifyContent: "center" } as any,
  videoScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.08)" } as any,
  topChip: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(17,27,33,0.62)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: ITEM - 60,
  },
  topChipText: { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
  playWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" } as any,
  playCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    paddingHorizontal: 8,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  nameText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  sizeText: { color: "rgba(255,255,255,0.85)", fontSize: 10, marginTop: 1 },
  saveBtn: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, paddingTop: 46, gap: 10 },
  emptyIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#D9EFDF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#BFE3C9",
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: THEME.colors.text, letterSpacing: -0.2 },
  emptySub: { fontSize: 13.5, color: THEME.colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: 8 },
  emptyActionWrap: { marginTop: 6, width: "100%", maxWidth: 320, gap: 8 },
  skeletonWrap: { flexDirection: "row", flexWrap: "wrap", gap: GAP, padding: GAP },
  skeletonCell: { width: ITEM, height: ITEM, borderRadius: 12, backgroundColor: "#E9EDEF", overflow: "hidden" },
  skeletonShimmer: { flex: 1, backgroundColor: "#F0F2F5" },
});
