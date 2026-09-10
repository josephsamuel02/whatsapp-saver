import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator, Alert, Image, FlatList, RefreshControl, Dimensions, Modal } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { THEME } from "../../constants/theme";
import * as Sharing from "expo-sharing";
import { useVideoPlayer, VideoView } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";

const GAP = 8; const COLS = 2; const ITEM = (Dimensions.get("window").width - GAP * (COLS + 1)) / COLS;
const W = Dimensions.get("window").width;
const H = Dimensions.get("window").height;

function SavedPreview({ assets, index, onClose, onIndexChange }: { assets: any[]; index: number | null; onClose: () => void; onIndexChange?: (i: number) => void }) {
  const [current, setCurrent] = useState(index ?? 0);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (index !== null && index !== undefined) setCurrent(index);
  }, [index]);

  useEffect(() => {
    if (index !== null && index !== undefined && listRef.current && assets.length > 0) {
      setTimeout(() => {
        try { listRef.current?.scrollToIndex({ index, animated: false }); } catch {}
      }, 50);
    }
  }, [index, assets.length]);

  if (index === null || assets.length === 0) return null;
  const asset = assets[current] ?? assets[index] ?? assets[0];
  if (!asset) return null;

  return (
    <Modal visible={index !== null} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <View style={pv.root}>
        <FlatList
          ref={listRef}
          data={assets}
          keyExtractor={(a) => a.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, idx) => ({ length: W, offset: W * idx, index: idx })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / W);
            if (idx >= 0 && idx < assets.length) {
              setCurrent(idx);
              onIndexChange?.(idx);
            }
          }}
          renderItem={({ item }) => (
            <View style={{ width: W, height: H }}>
              <View style={pv.media}>
                {item.mediaType === "video" ? <VideoPreview asset={item} active={assets[current]?.id === item.id} /> : <Image source={{ uri: item.uri }} style={pv.img} resizeMode="contain" />}
              </View>
            </View>
          )}
        />
        <View style={pv.topBar}>
          <Pressable onPress={onClose} style={pv.iconBtn}><Ionicons name="arrow-back" size={20} color="#fff" /></Pressable>
          <View style={{ flex: 1 }} />
          <View style={{ width: 38 }} />
        </View>
        <View style={pv.bottom}>
          <Pressable onPress={async () => { try { if (asset) await Sharing.shareAsync(asset.uri); } catch (e:any){ Alert.alert("Share failed", e?.message); } }} style={pv.btn}><Ionicons name="share-outline" size={18} color="#fff" /><Text style={pv.btnT}>Share</Text></Pressable>
          <Pressable onPress={onClose} style={[pv.btn, pv.btnPrimary]}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={pv.btnT}>Done</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
function VideoPreview({ asset, active }: { asset: any; active?: boolean }) {
  const player = useVideoPlayer(asset.uri, (p: any) => { p.loop = true; });
  useEffect(() => {
    if (active === false) {
      try { player.pause(); } catch {}
      return;
    }
    const t = setTimeout(() => {
      try { player.play(); } catch {}
    }, 300);
    return () => {
      clearTimeout(t);
      try { player.pause(); } catch {}
    };
  }, [player, asset.uri, active]);
  return <VideoView player={player} style={{ width: "100%", height: "100%" }} contentFit="contain" nativeControls />;
}

function SavedThumb({ asset }: { asset: any }) {
  const isVideo = asset.mediaType === "video";
  const [thumb, setThumb] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setThumb(null);
    setFailed(false);
    if (!isVideo) return;
    VideoThumbnails.getThumbnailAsync(asset.uri, { time: 500, quality: 0.6 })
      .then(({ uri }) => {
        if (!cancelled) setThumb(uri);
      })
      .catch(() => {
        if (!cancelled) setThumb(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isVideo, asset.uri, asset.id]);
  if (failed) {
    return (
      <View style={s.thumbFallback}>
        <Ionicons name={isVideo ? "videocam-outline" : "image-outline"} size={30} color="#8A9BA3" />
      </View>
    );
  }
  return (
    <>
      <Image
        source={{ uri: isVideo ? thumb ?? asset.uri : asset.uri }}
        style={s.thumb}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
      {isVideo && <View style={s.play}><Ionicons name="play" size={14} color="#fff" /></View>}
    </>
  );
}
const pv = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingTop: 44, paddingHorizontal: 12, paddingBottom: 12, backgroundColor: "rgba(0,0,0,0.55)", gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  media: { flex: 1, alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: "100%" },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 10, padding: 12, paddingBottom: 24, backgroundColor: "rgba(0,0,0,0.55)" },
  btn: { flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 12, paddingVertical: 13 },
  btnPrimary: { backgroundColor: THEME.colors.primary },
  btnT: { color: "#fff", fontWeight: "800" },
});

export default function SavedScreen() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [perm, setPerm] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const p = await MediaLibrary.getPermissionsAsync();
      if (!p.granted) { const r = await MediaLibrary.requestPermissionsAsync(); if (!r.granted) { if (mounted.current) { setPerm(false); setLoading(false); } return; } }
      if (mounted.current) setPerm(true);
      const album = await MediaLibrary.getAlbumAsync("Status Saver");
      if (!album) { if (mounted.current) setAssets([]); return; }
      const res = await (MediaLibrary as any).getAssetsAsync({ album, sortBy: ["creationTime"], first: 200, mediaType: ["photo", "video"] });
      if (mounted.current) setAssets(res.assets);
    } catch (e) { /* ignore */ }
    finally { if (mounted.current) { setLoading(false); setRefreshing(false); } }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={THEME.colors.primary} /></View>;
  }
  if (!perm) {
    return (
      <View style={s.center}>
        <Ionicons name="lock-closed-outline" size={42} color={THEME.colors.textMuted} />
        <Text style={s.title}>Gallery access needed</Text>
        <Pressable onPress={() => Linking.openSettings()} style={s.btnPrimary}><Text style={s.btnPrimaryT}>Open Settings</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      {assets.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={null as any}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}><Ionicons name="folder-outline" size={40} color={THEME.colors.primary} /></View>
              <Text style={s.emptyTitle}>Nothing saved yet</Text>
            </View>
          }
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); }} tintColor={THEME.colors.primary} />}
        />
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(a) => a.id}
          numColumns={COLS}
          contentContainerStyle={{ padding: GAP, gap: GAP, paddingBottom: 24 }}
          columnWrapperStyle={{ gap: GAP }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); }} tintColor={THEME.colors.primary} />}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => setSelectedIndex(index)}
              style={s.cell}
            >
              <SavedThumb asset={item} />
            </Pressable>
          )}
        />
      )}
      <SavedPreview assets={assets} index={selectedIndex} onClose={() => setSelectedIndex(null)} onIndexChange={setSelectedIndex} />
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24, backgroundColor: THEME.colors.background },
  title: { fontSize: 15, fontWeight: "800", color: THEME.colors.text },
  btnPrimary: { backgroundColor: THEME.colors.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, marginTop: 8 },
  btnPrimaryT: { color: "#fff", fontWeight: "800" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 26, gap: 10 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#D9EFDF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#BFE3C9" },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: THEME.colors.text },
  cell: { width: ITEM, height: ITEM * 1.15, borderRadius: 14, overflow: "hidden", backgroundColor: "#E9EDEF", borderWidth: 1, borderColor: THEME.colors.border },
  thumb: { width: "100%", height: "100%" } as any,
  thumbFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "#1E2A30" } as any,
  play: { position: "absolute", bottom: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center" } as any,
});
