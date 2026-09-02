import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Platform, Pressable, Alert, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { THEME } from "../../constants/theme";
import { StatusFile, saveMultipleToGallery } from "../../lib/statusService";
import { StatusGrid } from "../../components/StatusGrid";
import { PreviewModal } from "../../components/PreviewModal";
import { PermissionGate } from "../../components/PermissionGate";
import { useStatuses } from "../../lib/useStatuses";

export default function ImagesScreen() {
  const { files, loading, refreshing, refresh } = useStatuses("image");
  const [selected, setSelected] = useState<StatusFile | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [hasMediaPerm, setHasMediaPerm] = useState<boolean | null>(null);

  const checkPerm = useCallback(async () => {
    if (Platform.OS !== "android") { setHasMediaPerm(true); return; }
    try { const p = await MediaLibrary.getPermissionsAsync(); setHasMediaPerm(!!p.granted); } catch { setHasMediaPerm(false); }
  }, []);
  useFocusEffect(useCallback(() => { checkPerm(); refresh(); }, [checkPerm]));

  const isSelection = selection.size > 0;
  const toggleSelect = (f: StatusFile) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(f.uri)) next.delete(f.uri); else next.add(f.uri);
      return next;
    });
  };
  const clearSelection = () => setSelection(new Set());

  const selectedFiles = files.filter((f) => selection.has(f.uri));

  async function handleSaveSelected() {
    if (selectedFiles.length === 0) return;
    setSavingAll(true);
    try {
      const r = await saveMultipleToGallery(selectedFiles);
      Alert.alert("Saved", `${r.saved} image${r.saved !== 1 ? "s" : ""} saved to Gallery • Album: Status Saver${r.errors ? ` • ${r.errors} failed` : ""}`);
      clearSelection();
    } catch (e: any) { Alert.alert("Save failed", e?.message ?? "Try again"); }
    finally { setSavingAll(false); }
  }

  async function handleSaveAll() {
    if (files.length === 0) return;
    setSavingAll(true);
    try {
      const r = await saveMultipleToGallery(files);
      Alert.alert("Saved", `${r.saved} image${r.saved !== 1 ? "s" : ""} saved`);
    } catch (e: any) { Alert.alert("Save failed", e?.message ?? "Check gallery permission"); }
    finally { setSavingAll(false); }
  }

  if (Platform.OS !== "android") {
    return (
      <View style={s.center}>
        <View style={s.centerIcon}><Ionicons name="phone-portrait-outline" size={42} color={THEME.colors.primary} /></View>
        <Text style={s.title}>Android only</Text>
        <Text style={s.sub}>iOS cannot access WhatsApp’s private files due to system sandboxing. Install this app on an Android device to save statuses.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      {/* Stats header */}
      <View style={s.statsCard}>
        <View style={s.statRow}>
          <View style={s.statIconBox}><Ionicons name="images" size={16} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.statValue}>{loading ? "—" : `${files.length} images`}</Text>
            <Text style={s.statLabel}>Auto-detects WhatsApp, Business, GB, FM & more • Pull to refresh</Text>
          </View>
          <Pressable onPress={() => refresh()} style={s.refreshBtn}>
            <Ionicons name="refresh" size={16} color={THEME.colors.primary} />
            <Text style={s.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {files.length > 1 && (
          <View style={s.batchBar}>
            {isSelection ? (
              <>
                <Pressable onPress={clearSelection} style={s.batchSecondary}><Text style={s.batchSecondaryText}>Clear ({selection.size})</Text></Pressable>
                <Pressable onPress={handleSaveSelected} disabled={savingAll} style={s.batchPrimary}>
                  {savingAll ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="download" size={14} color="#fff" />}
                  <Text style={s.batchPrimaryText}>Save Selected</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.batchHint}>Long-press to multi-select</Text>
                <Pressable onPress={handleSaveAll} disabled={savingAll || files.length === 0} style={[s.batchPrimary, (savingAll || files.length === 0) && { opacity: 0.6 }]}>
                  {savingAll ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="download-outline" size={14} color="#fff" />}
                  <Text style={s.batchPrimaryText}>Save All</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>

      {files.length === 0 && !loading ? <PermissionGate onGranted={refresh} /> : null}

      {/* Helper hint when got files but media permission missing for saving */}
      {files.length > 0 && hasMediaPerm === false && (
        <View style={s.warnCard}>
          <Ionicons name="alert-circle" size={16} color="#B7791F" />
          <Text style={s.warnText}>Allow gallery permission to save — tap “Grant Statuses Folder Access” then also allow Photos when saving.</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
            <Text style={s.loadingText}>Scanning WhatsApp folders…</Text>
            <Text style={s.loadingSub}>Checking 60+ status locations + granted folders</Text>
          </View>
        ) : (
          <StatusGrid
            data={files}
            onPress={setSelected}
            onLongPress={toggleSelect}
            emptyText="No image statuses found. Open WhatsApp or WhatsApp Business, view a status, then return and tap Refresh. If you use GBWhatsApp/FMWhatsApp, make sure you’ve granted the .Statuses folder above."
            refreshing={refreshing}
            onRefresh={refresh}
            selectedIds={selection}
            onToggleSelect={toggleSelect}
            selectionMode={isSelection}
          />
        )}
      </View>

      <PreviewModal file={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  statsCard: { margin: 12, marginBottom: 6, backgroundColor: "#fff", borderRadius: 16, padding: 12, gap: 10, borderWidth: 1, borderColor: THEME.colors.border },
  statRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: THEME.colors.primary, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 14, fontWeight: "800", color: THEME.colors.text },
  statLabel: { fontSize: 11, color: THEME.colors.textSecondary, marginTop: 1, lineHeight: 13 },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E7F8EC", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#D0F0D8" },
  refreshText: { fontSize: 12, fontWeight: "800", color: THEME.colors.primary },
  batchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: THEME.colors.divider, marginTop: 2 },
  batchHint: { flex: 1, fontSize: 11.5, color: THEME.colors.textMuted, fontWeight: "600" },
  batchPrimary: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  batchPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
  batchSecondary: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: "#fff" },
  batchSecondaryText: { color: THEME.colors.text, fontWeight: "700", fontSize: 12.5 },
  warnCard: { flexDirection: "row", gap: 8, alignItems: "center", marginHorizontal: 12, backgroundColor: "#FFF7E6", borderWidth: 1, borderColor: "#F9E0A2", padding: 10, borderRadius: 12 },
  warnText: { flex: 1, fontSize: 11.5, color: "#7A5A12", lineHeight: 15 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 28 },
  loadingText: { fontSize: 15, fontWeight: "800", color: THEME.colors.text },
  loadingSub: { fontSize: 12, color: THEME.colors.textMuted, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10, backgroundColor: THEME.colors.background },
  centerIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#E7F8EC", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D0F0D8" },
  title: { fontSize: 18, fontWeight: "800", color: THEME.colors.text },
  sub: { fontSize: 13, color: THEME.colors.textSecondary, textAlign: "center", lineHeight: 19 },
});
