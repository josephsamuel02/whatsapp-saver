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
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { THEME } from "../constants/theme";
import type { StatusFile } from "../lib/statusService";
import { saveToGallery, shareFile, shareToWhatsApp, formatBytes, formatDate } from "../lib/statusService";

const W = Dimensions.get("window").width;
const H = Dimensions.get("window").height;

// Isolated video component so hooks are never conditional
function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p: any) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    // Autoplay after player ready
    t = setTimeout(() => {
      try { player.play(); } catch {}
    }, 320);
    return () => {
      clearTimeout(t);
      try { player.pause(); } catch {}
    };
  }, [player, uri]);

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

export function PreviewModal({
  file,
  onClose,
}: {
  file: StatusFile | null;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const sheetAnim = useRef(0);

  useEffect(() => {
    if (file) setShowInfo(false);
  }, [file?.uri]);

  if (!file) return null;

  async function handleSave() {
    try {
      setSaving(true);
      await saveToGallery(file!.uri, file!.name);
      setSavedPulse(true);
      setTimeout(() => setSavedPulse(false), 1800);
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
    try { await shareToWhatsApp(file!.uri, file!.name); } catch (e: any) { Alert.alert("Share failed", e?.message ?? "Try again"); }
  }

  const isVideo = file.type === "video";

  return (
    <Modal visible={!!file} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {/* Media */}
        <View style={styles.mediaWrap}>
          {isVideo ? (
            <VideoPreview uri={file.uri} />
          ) : (
            <ScrollView
              contentContainerStyle={styles.imageScrollContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              bouncesZoom
              centerContent
            >
              <Image source={{ uri: file.uri }} style={styles.image} resizeMode="contain" />
            </ScrollView>
          )}
        </View>

        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          <View style={styles.titleBox}>
            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
            <Text style={styles.fileMeta} numberOfLines={1}>{file.sourceLabel} • {formatBytes(file.size)} • {formatDate(file.mtime)}</Text>
          </View>
          <Pressable onPress={() => setShowInfo((v) => !v)} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name={showInfo ? "information-circle" : "information-circle-outline"} size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Info sheet */}
        {showInfo && (
          <View style={styles.infoSheet}>
            <View style={styles.infoRow}>
              <Ionicons name="document-outline" size={16} color="#667781" />
              <Text style={styles.infoLabel}>File</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{file.name}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="folder-outline" size={16} color="#667781" />
              <Text style={styles.infoLabel}>Source</Text>
              <Text style={styles.infoValue}>{file.sourceLabel}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="resize-outline" size={16} color="#667781" />
              <Text style={styles.infoLabel}>Size</Text>
              <Text style={styles.infoValue}>{formatBytes(file.size)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color="#667781" />
              <Text style={styles.infoLabel}>Saved on</Text>
              <Text style={styles.infoValue}>{file.mtime ? new Date(file.mtime).toLocaleString() : "—"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="videocam-outline" size={16} color="#667781" />
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{isVideo ? "Video" : "Image"} • {file.isSAF ? "via granted folder" : "direct storage"}</Text>
            </View>
            <Text style={styles.infoHint}>Tip: pinch to zoom images • videos play with sound</Text>
          </View>
        )}

        {/* Saved pulse */}
        {savedPulse && (
          <View style={styles.savedToast}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.savedToastText}>Saved to Gallery • Album: Status Saver</Text>
          </View>
        )}

        {/* Bottom actions */}
        <View style={styles.bottomBar}>
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
  imageScrollContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", width: W, height: H },
  image: { width: W, height: H - 160, alignSelf: "center" },
  video: { width: W, height: H - 170 },
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
  titleBox: { flex: 1, gap: 2 },
  fileName: { color: "#fff", fontSize: 13.5, fontWeight: "700", letterSpacing: -0.1 },
  fileMeta: { color: "rgba(255,255,255,0.78)", fontSize: 11, fontWeight: "500" },
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
  repostBtn: { backgroundColor: "rgba(37,211,102,0.18)", borderColor: "rgba(37,211,102,0.28)" },
  saveBtn: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primaryDark },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 13.5, letterSpacing: 0.15 },
  infoSheet: {
    position: "absolute",
    top: 92, left: 12, right: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    elevation: 6,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoLabel: { width: 62, fontSize: 12.5, fontWeight: "700", color: THEME.colors.textSecondary },
  infoValue: { flex: 1, fontSize: 12.5, color: THEME.colors.text, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: THEME.colors.border, marginVertical: 2 },
  infoHint: { fontSize: 11, color: THEME.colors.textMuted, marginTop: 4, lineHeight: 15 },
  savedToast: {
    position: "absolute",
    bottom: 92, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1ea54a",
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999,
    elevation: 4,
  },
  savedToastText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
});
