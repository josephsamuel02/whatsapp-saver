import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator, Alert, Image, FlatList, RefreshControl, Dimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { THEME } from "../../constants/theme";
import * as Sharing from "expo-sharing";
import { useVideoPlayer, VideoView } from "expo-video";

const GAP = 3; const COLS = 3; const ITEM = (Dimensions.get("window").width - GAP * 4) / COLS;

function SavedPreview({ asset, onClose }: { asset: any | null; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  if (!asset) return null;
  const isVideo = asset.mediaType === "video";
  return (
    <View style={pv.root}>
      <View style={pv.topBar}>
        <Pressable onPress={onClose} style={pv.iconBtn}><Ionicons name="close" size={20} color="#fff" /></Pressable>
        <Text style={pv.name} numberOfLines={1}>{asset.filename}</Text>
        <View style={{ width: 38 }} />
      </View>
      <View style={pv.media}>
        {isVideo ? <VideoPreview asset={asset} /> : <Image source={{ uri: asset.uri }} style={pv.img} resizeMode="contain" />}
      </View>
      <View style={pv.bottom}>
        <Pressable onPress={async () => { try { await Sharing.shareAsync(asset.uri); } catch (e:any){ Alert.alert("Share failed", e?.message); } }} style={pv.btn}><Ionicons name="share-outline" size={18} color="#fff" /><Text style={pv.btnT}>Share</Text></Pressable>
        <Pressable onPress={onClose} style={[pv.btn, pv.btnPrimary]}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={pv.btnT}>Done</Text></Pressable>
      </View>
    </View>
  );
}
function VideoPreview({ asset }: { asset: any }) {
  const player = useVideoPlayer(asset.uri, (p: any) => { p.loop = false; });
  return <VideoView player={player} style={{ width: "100%", height: "100%" }} contentFit="contain" nativeControls />;
}
const pv = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  topBar: { flexDirection: "row", alignItems: "center", paddingTop: 44, paddingHorizontal: 12, paddingBottom: 12, backgroundColor: "rgba(0,0,0,0.55)", gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  name: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 13 },
  media: { flex: 1, alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: "100%" },
  bottom: { flexDirection: "row", gap: 10, padding: 12, paddingBottom: 24, backgroundColor: "rgba(0,0,0,0.55)" },
  btn: { flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 12, paddingVertical: 13 },
  btnPrimary: { backgroundColor: THEME.colors.primary },
  btnT: { color: "#fff", fontWeight: "800" },
});

export default function SavedScreen() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [perm, setPerm] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const p = await MediaLibrary.getPermissionsAsync();
      if (!p.granted) { const r = await MediaLibrary.requestPermissionsAsync(); if (!r.granted) { setPerm(false); setLoading(false); return; } }
      setPerm(true);
      const album = await MediaLibrary.getAlbumAsync("Status Saver");
      if (!album) { setAssets([]); return; }
      const res = await MediaLibrary.getAssetsAsync({ album: album.id, sortBy: ["creationTime"], first: 200, mediaType: ["photo", "video"] });
      setAssets(res.assets);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  if (selected) {
    return (
      <View style={{ flex: 1 }}>
        <SavedPreview asset={selected} onClose={() => setSelected(null)} />
      </View>
    );
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={THEME.colors.primary} /><Text style={s.title}>Loading saved…</Text></View>;
  }
  if (!perm) {
    return (
      <View style={s.center}>
        <Ionicons name="lock-closed-outline" size={42} color={THEME.colors.textMuted} />
        <Text style={s.title}>Gallery access needed</Text>
        <Text style={s.sub}>Allow Photos access to see your saved statuses.</Text>
        <Pressable onPress={() => Linking.openSettings()} style={s.btnPrimary}><Text style={s.btnPrimaryT}>Open Settings</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      <View style={s.headerCard}>
        <View style={s.hdrRow}>
          <View style={s.hdrIcon}><Ionicons name="bookmark" size={18} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.hdrTitle}>{assets.length} saved</Text>
            <Text style={s.hdrSub}>Album: Status Saver • DCIM • Also visible in your Gallery app</Text>
          </View>
          <Pressable onPress={async () => { setRefreshing(true); await load(); }} style={s.hdrBtn}><Ionicons name="refresh" size={16} color={THEME.colors.primary} /><Text style={s.hdrBtnT}>Refresh</Text></Pressable>
        </View>
        <View style={s.div} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => Linking.openSettings()} style={s.secondaryBtn}><Ionicons name="images-outline" size={14} color={THEME.colors.text} /><Text style={s.secondaryBtnT}>Open Gallery App</Text></Pressable>
          <View style={{ flex: 1 }} />
          <Text style={s.hint}>Tap to preview • Long-press to share</Text>
        </View>
      </View>

      {assets.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}><Ionicons name="bookmark-outline" size={40} color={THEME.colors.primary} /></View>
          <Text style={s.emptyTitle}>Nothing saved yet</Text>
          <Text style={s.emptySub}>Saved statuses appear here after you tap “Save” on any image or video. They’re also in your phone’s Gallery → Albums → Status Saver.</Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(a) => a.id}
          numColumns={COLS}
          contentContainerStyle={{ padding: GAP, gap: GAP, paddingBottom: 24 }}
          columnWrapperStyle={{ gap: GAP }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); }} tintColor={THEME.colors.primary} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelected(item)} style={s.cell}>
              <Image source={{ uri: item.uri }} style={s.thumb} resizeMode="cover" />
              {item.mediaType === "video" && <View style={s.play}><Ionicons name="play" size={12} color="#fff" /></View>}
              <View style={s.durChip}><Text style={s.durText}>{item.mediaType === "video" ? "Video" : "Image"}</Text></View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  headerCard: { margin: 12, backgroundColor: "#fff", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: THEME.colors.border, gap: 10 },
  hdrRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  hdrIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: THEME.colors.waTeal, alignItems: "center", justifyContent: "center" },
  hdrTitle: { fontSize: 14, fontWeight: "800", color: THEME.colors.text },
  hdrSub: { fontSize: 11, color: THEME.colors.textSecondary, marginTop: 1 },
  hdrBtn: { flexDirection: "row", gap: 5, alignItems: "center", backgroundColor: "#E7F8EC", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "#D0F0D8" },
  hdrBtnT: { fontSize: 12, fontWeight: "800", color: THEME.colors.primary },
  div: { height: 1, backgroundColor: THEME.colors.divider },
  secondaryBtn: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: "#F0F2F5", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: THEME.colors.border },
  secondaryBtnT: { fontSize: 12, fontWeight: "700", color: THEME.colors.text },
  hint: { fontSize: 11, color: THEME.colors.textMuted, alignSelf: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24, backgroundColor: THEME.colors.background },
  title: { fontSize: 15, fontWeight: "800", color: THEME.colors.text },
  sub: { fontSize: 13, color: THEME.colors.textSecondary, textAlign: "center", lineHeight: 19 },
  btnPrimary: { backgroundColor: THEME.colors.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, marginTop: 8 },
  btnPrimaryT: { color: "#fff", fontWeight: "800" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 26, gap: 10 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#E7F8EC", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D0F0D8" },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: THEME.colors.text },
  emptySub: { fontSize: 13, color: THEME.colors.textSecondary, textAlign: "center", lineHeight: 19 },
  cell: { width: ITEM, height: ITEM, borderRadius: 12, overflow: "hidden", backgroundColor: "#E9EDEF", borderWidth: 1, borderColor: THEME.colors.border },
  thumb: { width: "100%", height: "100%" } as any,
  play: { position: "absolute", bottom: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center" } as any,
  durChip: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(17,27,33,0.62)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 } as any,
  durText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
