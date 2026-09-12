import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { THEME } from "../constants/theme";
import type { StatusFile } from "../lib/statusService";
import { saveToGallery, shareFile, shareToWhatsApp, formatBytes, ensureLocalUri, isContentUri } from "../lib/statusService";

const W = Dimensions.get("window").width;
const H = Dimensions.get("window").height;

function VideoPreview({ uri, name, active }: { uri: string; name: string; active: boolean }) {
  const [playUri, setPlayUri] = useState<string | null>(
    isContentUri(uri) ? null : uri
  );
  const [stageFailed, setStageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isContentUri(uri)) {
      setPlayUri(uri);
      return;
    }
    setPlayUri(null);
    setStageFailed(false);
    ensureLocalUri(uri, name)
      .then((local) => {
        if (!cancelled) setPlayUri(local);
      })
      .catch(() => {
        if (!cancelled) setStageFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [uri, name]);

  if (stageFailed) {
    return (
      <View style={styles.videoFallback}>
        <Ionicons name="videocam-off-outline" size={44} color="#8A9BA3" />
        <Text style={styles.videoFallbackText}>Could not load this video</Text>
      </View>
    );
  }

  if (!playUri) {
    return (
      <View style={styles.videoFallback}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.videoFallbackText}>Loading video…</Text>
      </View>
    );
  }

  return <VideoPlayerInner uri={playUri} active={active} />;
}

function VideoPlayerInner({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p: any) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => {
        try { player.play(); } catch {}
      }, 320);
      return () => {
        clearTimeout(t);
        try { player.pause(); } catch {}
      };
    } else {
      try { player.pause(); } catch {}
    }
  }, [player, uri, active]);

  useEffect(() => {
    return () => {
      try { player.pause(); } catch {}
    };
  }, [player]);

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
      allowsFullscreen
      allowsPictureInPicture={false}
    />
  );
}

function ImagePreview({ uri, name }: { uri: string; name: string }) {
  const [src, setSrc] = useState(uri);
  const [failed, setFailed] = useState(false);
  const [staging, setStaging] = useState(false);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const lastTap = useRef(0);
  const pinch = useRef<{ dist: number; scale: number; tx: number; ty: number } | null>(null);
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const zoom = useRef({ scale: 1, tx: 0, ty: 0 });
  zoom.current = { scale, tx, ty };

  useEffect(() => {
    setSrc(uri);
    setFailed(false);
    setStaging(false);
    setScale(1);
    setTx(0);
    setTy(0);
    lastTap.current = 0;
    pinch.current = null;
    pan.current = null;
  }, [uri]);

  async function handleError() {
    if (!isContentUri(uri) || staging || failed) {
      setFailed(true);
      return;
    }
    setStaging(true);
    try {
      const local = await ensureLocalUri(uri, name);
      setSrc(local);
    } catch {
      setFailed(true);
    } finally {
      setStaging(false);
    }
  }

  if (failed) {
    return (
      <View style={styles.videoFallback}>
        <Ionicons name="image-outline" size={44} color="#8A9BA3" />
        <Text style={styles.videoFallbackText}>Could not load this image</Text>
      </View>
    );
  }

  const clampPan = (s: number, x: number, y: number) => {
    if (s <= 1) return { x: 0, y: 0 };
    const maxX = ((s - 1) * W) / 2;
    const maxY = ((s - 1) * (H - 160)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const applyZoom = (s: number, x: number, y: number) => {
    const clamped = Math.max(1, Math.min(4, s));
    const p = clampPan(clamped, x, y);
    setScale(clamped);
    setTx(p.x);
    setTy(p.y);
  };

  const fingerDist = (touches: Array<{ pageX: number; pageY: number }>) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  return (
    <View
      style={styles.imageZoomWrap}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => zoom.current.scale > 1}
      onResponderGrant={(e: any) => {
        const touches = e.nativeEvent.touches ?? [];
        if (touches.length === 2) {
          pinch.current = { dist: fingerDist(touches), scale, tx, ty };
          pan.current = null;
        } else if (touches.length === 1) {
          pan.current = { x: touches[0].pageX, y: touches[0].pageY, tx, ty };
        }
      }}
      onResponderMove={(e: any) => {
        const touches = e.nativeEvent.touches ?? [];
        if (touches.length === 2) {
          const d = fingerDist(touches);
          if (d > 0) {
            if (!pinch.current) {
              pinch.current = { dist: d, scale, tx, ty };
            } else {
              const p = pinch.current;
              applyZoom((p.scale * d) / p.dist, p.tx, p.ty);
            }
          }
          pan.current = null;
        } else if (touches.length === 1 && scale > 1 && pan.current) {
          const p = pan.current;
          const nx = p.tx + (touches[0].pageX - p.x);
          const ny = p.ty + (touches[0].pageY - p.y);
          const c = clampPan(scale, nx, ny);
          setTx(c.x);
          setTy(c.y);
        }
      }}
      onResponderRelease={(e: any) => {
        const wasPinch = pinch.current !== null;
        pinch.current = null;
        pan.current = null;
        if (wasPinch) return;
        const now = Date.now();
        if (now - lastTap.current < 280) {
          lastTap.current = 0;
          if (zoom.current.scale > 1) {
            applyZoom(1, 0, 0);
          } else {
            applyZoom(2.5, 0, 0);
          }
        } else {
          lastTap.current = now;
        }
      }}
      onResponderTerminate={() => {
        pinch.current = null;
        pan.current = null;
      }}
    >
      <View style={{ transform: [{ translateX: tx }, { translateY: ty }, { scale }] }}>
        <Image source={{ uri: src }} style={styles.image} resizeMode="contain" onError={handleError} />
      </View>
      {staging && (
        <View style={styles.stagingBadge}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
      {scale === 1 && !staging && (
        <View style={styles.zoomHint} pointerEvents="none">
          <Ionicons name="expand-outline" size={12} color="rgba(255,255,255,0.8)" />
          <Text style={styles.zoomHintText}>Double-tap or pinch to zoom</Text>
        </View>
      )}
    </View>
  );
}

type PreviewProps =
  | { file: StatusFile | null; onClose: () => void; files?: undefined; index?: undefined }
  | { files: StatusFile[]; index: number | null; onClose: () => void; file?: undefined; onIndexChange?: (i: number) => void };

export function PreviewModal(props: PreviewProps) {
  const files: StatusFile[] = (props as any).files ?? (((props as any).file ? [(props as any).file] : []));
  const propIndex: number | null =
    (props as any).index !== undefined ? (props as any).index : files.length > 0 ? 0 : null;

  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (propIndex !== null && propIndex !== undefined) setCurrent(propIndex);
  }, [propIndex]);

  useEffect(() => {
    if (propIndex !== null && propIndex !== undefined && listRef.current && files.length > 0) {
      setTimeout(() => {
        try { listRef.current?.scrollToIndex({ index: propIndex, animated: false }); } catch {}
      }, 50);
    }
  }, [propIndex]);

  useEffect(() => {
    return () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    };
  }, []);

  if (propIndex === null || propIndex === undefined || files.length === 0) return null;
  const file = files[current] ?? files[propIndex] ?? files[0];
  if (!file) return null;

  async function handleSave() {
    try {
      setSaving(true);
      await saveToGallery(file!.uri, file!.name);
      setSavedPulse(true);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setSavedPulse(false), 1800);
    } catch (e: any) {
      Alert.alert("Could not save", e?.message ?? "Check gallery permission in Settings");
    } finally {
      setSaving(false);
    }
  }
  async function handleShare() {
    try { await shareFile(file!.uri, file!.name); } catch (e: any) { Alert.alert("Share failed", e?.message ?? "Try again"); }
  }
  async function handleShareToWhatsApp() {
    try { await shareToWhatsApp(file!.uri, file!.name, (file as any).sourceLabel, (file as any).source); } catch (e: any) { Alert.alert("Share failed", e?.message ?? "Try again"); }
  }

  const isVideo = file.type === "video";
  const visible = propIndex !== null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={props.onClose} statusBarTranslucent>
      <View style={styles.root}>
        <FlatList
          ref={listRef}
          data={files}
          keyExtractor={(i) => i.uri}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={propIndex ?? 0}
          getItemLayout={(_, idx) => ({ length: W, offset: W * idx, index: idx })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / W);
            if (idx >= 0 && idx < files.length) {
              setCurrent(idx);
              (props as any).onIndexChange?.(idx);
            }
          }}
          renderItem={({ item, index: idx }) => (
            <View style={{ width: W, height: H }}>
              <View style={styles.mediaWrap}>
                {item.type === "video" ? (
                  <VideoPreview uri={item.uri} name={item.name} active={idx === current} />
                ) : (
                  <ImagePreview uri={item.uri} name={item.name} />
                )}
              </View>
            </View>
          )}
        />

        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 0) + 12 }]}>
          <Pressable onPress={props.onClose} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.titleBox}>
            <Text style={styles.fileMeta} numberOfLines={1}>{formatBytes(file.size)}</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {savedPulse && (
          <View style={[styles.savedToast, { bottom: insets.bottom + 100 }]}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.savedToastText}>Saved to Gallery</Text>
          </View>
        )}

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={handleShare} style={styles.actionBtn} android_ripple={{ color: "rgba(255,255,255,0.12)" }}>
            <Ionicons name="share-outline" size={19} color="#fff" />
            <Text style={styles.actionText}>Share</Text>
          </Pressable>

          <Pressable onPress={handleShareToWhatsApp} style={[styles.actionBtn, styles.repostBtn]} android_ripple={{ color: "rgba(255,255,255,0.14)" }}>
            <Ionicons name="paper-plane-outline" size={18} color="#fff" />
            <Text style={styles.actionText}>Repost</Text>
          </Pressable>

          <Pressable onPress={handleSave} disabled={saving} style={[styles.actionBtn, styles.saveBtn, saving && { opacity: 0.7 }]}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="download-outline" size={19} color="#fff" />}
            <Text style={styles.actionText}>{saving ? "Saving…" : savedPulse ? "Saved ✓" : "Save"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  mediaWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  imageZoomWrap: { width: W, height: H - 160, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: W, height: H - 160, alignSelf: "center" },
  zoomHint: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  zoomHintText: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600" },
  video: { width: W, height: H - 170 },
  videoFallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  videoFallbackText: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600" },
  stagingBadge: {
    position: "absolute",
    bottom: 90,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
    padding: 8,
  },
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 42,
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.56)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  titleBox: { flex: 1, alignItems: "center" },
  fileMeta: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  bottomBar: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    flexDirection: "row",
    gap: 10,
    padding: 12,
    paddingBottom: 22,
    backgroundColor: "rgba(0,0,0,0.58)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 13,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  repostBtn: { backgroundColor: "rgba(21,149,82,0.35)", borderColor: "rgba(21,149,82,0.4)" },
  saveBtn: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primaryDark },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 13.5, letterSpacing: 0.15 },
  savedToast: {
    position: "absolute",
    bottom: 92, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#159552",
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999,
    elevation: 4,
  },
  savedToastText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
});
