import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { THEME } from "../constants/theme";

export function PermissionGate({ onGranted }: { onGranted?: () => void }) {
  const [checking, setChecking] = useState(true);
  const [requesting, setRequesting] = useState(false);

  async function refresh() {
    try {
      const p = await MediaLibrary.getPermissionsAsync();
      if (p.granted) onGranted?.();
    } catch {}
    finally { setChecking(false); }
  }
  useEffect(() => { refresh(); }, []);

  if (Platform.OS !== "android") return null;
  if (checking) return <View style={s.shell}><ActivityIndicator color={THEME.colors.primary} /></View>;

  async function handleGrant() {
    if (requesting) return;
    setRequesting(true);
    try {
      const r = await MediaLibrary.requestPermissionsAsync();
      if (r.granted) {
        await refresh();
        return;
      }
      // Automatically open settings if denied permanently - no manual folder steps
      if (!r.canAskAgain) {
        await Linking.openSettings();
      }
      await refresh();
    } finally { setRequesting(false); }
  }

  return (
    <View style={s.card}>
      <View style={s.iconWrap}><Ionicons name="lock-closed-outline" size={28} color={THEME.colors.primary} /></View>
      <Text style={s.title}>Permission needed</Text>
      <Text style={s.sub}>Allow access to automatically find WhatsApp statuses</Text>
      <Pressable onPress={handleGrant} disabled={requesting} style={[s.btn, requesting && { opacity: 0.7 }]}>
        {requesting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />}
        <Text style={s.btnText}>{requesting ? "Requesting…" : "Allow Access"}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  shell: { padding: 20, alignItems: "center" },
  card: {
    margin: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#E7F8EC", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D0F0D8" },
  title: { fontSize: 15, fontWeight: "800", color: THEME.colors.text },
  sub: { fontSize: 12.5, color: THEME.colors.textSecondary, textAlign: "center", lineHeight: 17 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: THEME.colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999, marginTop: 4, minWidth: 160 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
});
