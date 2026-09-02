import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, Platform, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { THEME } from "../constants/theme";
import * as FileSystem from "expo-file-system";
import { hasSAFGrant, requestSAFPermission } from "../lib/statusService";

export function PermissionGate({ onGranted }: { onGranted?: () => void }) {
  const [mediaGranted, setMediaGranted] = useState<boolean | null>(null);
  const [safGranted, setSafGranted] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [checking, setChecking] = useState(true);

  async function refresh() {
    try {
      const p = await MediaLibrary.getPermissionsAsync();
      setMediaGranted(!!p.granted);
      const saf = await hasSAFGrant();
      setSafGranted(saf);
    } catch { setMediaGranted(false); }
    finally { setChecking(false); }
  }
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (mediaGranted || safGranted) onGranted?.();
  }, [mediaGranted, safGranted]);

  if (Platform.OS !== "android") return null;
  if (checking) return <View style={s.shell}><ActivityIndicator color={THEME.colors.primary} /></View>;
  if (mediaGranted || safGranted) return null;

  const needsSAF = true; // Always show SAF as primary for Android 11+

  async function handleAllowAllFiles() {
    setRequesting(true);
    try {
      const r = await MediaLibrary.requestPermissionsAsync();
      if (r.granted) { await refresh(); return; }
      if (!r.canAskAgain) {
        Alert.alert(
          "Permission required",
          "Please enable Photos and videos permission in Settings to save statuses, and also allow All files access.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        await refresh();
      }
    } finally { setRequesting(false); }
  }

  async function handleGrantFolder() {
    setRequesting(true);
    try {
      const granted = await requestSAFPermission();
      if (granted) { await refresh(); }
      else {
        Alert.alert("Folder not granted", "Select the .Statuses folder when the system picker opens. Example:\n\nWhatsApp/Media/.Statuses   or\nAndroid/media/com.whatsapp/WhatsApp/Media/.Statuses");
      }
    } catch (e: any) {
      Alert.alert("Not supported", e?.message ?? "Folder picker not available on this device. Please grant All files access in Settings.");
    } finally { setRequesting(false); }
  }

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.iconBadge}><Ionicons name="folder-open" size={20} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Enable status access</Text>
          <Text style={s.sub}>Choose one method — Folder access is 100% reliable on Android 11-14</Text>
        </View>
      </View>

      <View style={s.methodCard}>
        <View style={s.methodHead}>
          <Ionicons name="shield-checkmark" size={16} color={THEME.colors.primary} />
          <Text style={s.methodTitle}>1. Grant folder access (Recommended)</Text>
          <View style={s.badge}><Text style={s.badgeText}>WORKS</Text></View>
        </View>
        <Text style={s.methodDesc}>Opens the system file picker. Navigate to WhatsApp & select the <Text style={{ fontWeight: "800" }}>.Statuses</Text> folder. Works for both WhatsApp & WhatsApp Business, even on Android 13/14.</Text>
        <Pressable onPress={handleGrantFolder} disabled={requesting} style={[s.primaryBtn]}>
          {requesting ? <ActivityIndicator color="#fff" /> : <Ionicons name="folder-open-outline" size={18} color="#fff" />}
          <Text style={s.primaryBtnText}>Grant Statuses Folder Access</Text>
        </Pressable>
        <Text style={s.hintText}>Picker path: Internal storage → WhatsApp → Media → .Statuses → Use this folder → Allow</Text>
      </View>

      <View style={[s.methodCard, s.methodCardAlt]}>
        <View style={s.methodHead}>
          <Ionicons name="phone-portrait-outline" size={16} color={THEME.colors.textSecondary} />
          <Text style={[s.methodTitle, { color: THEME.colors.textSecondary }]}>2. Allow gallery permission</Text>
        </View>
        <Text style={s.methodDesc}>Required to save statuses to your gallery. Some devices also need “Allow management of all files”.*</Text>
        <Pressable onPress={handleAllowAllFiles} disabled={requesting} style={s.secondaryBtn}>
          <Ionicons name="images-outline" size={18} color={THEME.colors.primary} />
          <Text style={s.secondaryBtnText}>Allow Photos & Media</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => Linking.openSettings()} style={s.linkRow}>
        <Ionicons name="settings-outline" size={14} color={THEME.colors.textSecondary} />
        <Text style={s.linkText}>Open App Settings if picker doesn’t appear</Text>
      </Pressable>

      <Text style={s.footerNote}>* On Android 11+ if you see “No statuses” after granting gallery only — please use Folder access above. Your files stay 100% on-device. We never upload anything.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  shell: { padding: 16, alignItems: "center" },
  card: {
    margin: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    elevation: 2,
  },
  headerRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  iconBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: THEME.colors.primary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "800", color: THEME.colors.text },
  sub: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 2, lineHeight: 16 },
  methodCard: { backgroundColor: "#F8FFFA", borderWidth: 1, borderColor: "#D8F0DC", borderRadius: 14, padding: 12, gap: 8 },
  methodCardAlt: { backgroundColor: "#FAFBFC", borderColor: THEME.colors.border },
  methodHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  methodTitle: { flex: 1, fontSize: 12.5, fontWeight: "800", color: THEME.colors.text },
  badge: { backgroundColor: THEME.colors.primary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  methodDesc: { fontSize: 12, color: THEME.colors.textSecondary, lineHeight: 17 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: THEME.colors.primary, borderRadius: 12, paddingVertical: 13, marginTop: 4 },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff", borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: THEME.colors.border },
  secondaryBtnText: { color: THEME.colors.primary, fontWeight: "800", fontSize: 13.5 },
  hintText: { fontSize: 11, color: THEME.colors.textMuted, lineHeight: 14, textAlign: "center" },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 },
  linkText: { fontSize: 12, color: THEME.colors.textSecondary, fontWeight: "600" },
  footerNote: { fontSize: 10.5, color: THEME.colors.textMuted, textAlign: "center", lineHeight: 14, marginTop: 2 },
});
