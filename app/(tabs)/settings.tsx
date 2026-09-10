import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  ActivityIndicator,
  AppState,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { THEME } from "../../constants/theme";
import {
  hasStoragePermission,
  hasMediaLibraryPermission,
  openAllFilesAccessSettings,
  requestSAFPermission,
  requestMediaLibraryPermission,
  getGrantedSAFUris,
} from "../../lib/storageAccess";

function SettingRow({
  icon,
  label,
  active,
  busy,
  onPress,
}: {
  icon: any;
  label: string;
  active: boolean | null;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!!busy}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={active ? THEME.colors.primary : THEME.colors.textMuted}
      />
      <Text style={s.label}>{label}</Text>
      {busy || active === null ? (
        <ActivityIndicator size="small" color={THEME.colors.textMuted} />
      ) : active ? (
        <View style={s.onBadge}>
          <Text style={s.onText}>On</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const [direct, setDirect] = useState<boolean | null>(null);
  const [waFolder, setWaFolder] = useState<boolean | null>(null);
  const [waBizFolder, setWaBizFolder] = useState<boolean | null>(null);
  const [media, setMedia] = useState<boolean | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, m, uris] = await Promise.all([
        hasStoragePermission(),
        hasMediaLibraryPermission(),
        getGrantedSAFUris(),
      ]);
      setDirect(d);
      setMedia(m);
      const lower = (uris || []).map((u) => {
        try { return decodeURIComponent(u).toLowerCase(); } catch { return u.toLowerCase(); }
      });
      const hasWa = lower.some((u) => u.includes("com.whatsapp") && !u.includes("w4b") && !u.includes("business"));
      const hasBiz = lower.some((u) => u.includes("w4b") || u.includes("business"));
      // If user granted a parent folder, both may resolve — fall back to generic SAF state
      const anySaf = lower.length > 0;
      setWaFolder(hasWa || (!hasWa && !hasBiz && anySaf ? true : hasWa));
      setWaBizFolder(hasBiz || (!hasWa && !hasBiz && anySaf ? true : hasBiz));
    } catch {
      setDirect(false);
      setWaFolder(false);
      setWaBizFolder(false);
      setMedia(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setDirect(null);
      setWaFolder(null);
      setWaBizFolder(null);
      setMedia(null);
      load();
    }, [load])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    return () => sub.remove();
  }, [load]);

  async function pickFolder(kind: "wa" | "biz") {
    if (busyKey) return;
    setBusyKey(kind);
    try {
      const { granted } = await requestSAFPermission();
      if (granted) await load();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleGallery() {
    if (busyKey) return;
    setBusyKey("media");
    try {
      const has = await hasMediaLibraryPermission();
      if (has) {
        await load();
        return;
      }
      const req = await requestMediaLibraryPermission();
      if (!req) await Linking.openSettings();
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.background, padding: 12 }}>
      <View style={s.card}>
        <SettingRow
          icon="folder-open-outline"
          label="Storage Access"
          active={direct}
          busy={false}
          onPress={() => openAllFilesAccessSettings()}
        />
        <View style={s.div} />
        <SettingRow
          icon="logo-whatsapp"
          label="WhatsApp Status Folder"
          active={waFolder}
          busy={busyKey === "wa"}
          onPress={() => pickFolder("wa")}
        />
        <View style={s.div} />
        <SettingRow
          icon="briefcase-outline"
          label="WhatsApp Business Folder"
          active={waBizFolder}
          busy={busyKey === "biz"}
          onPress={() => pickFolder("biz")}
        />
        <View style={s.div} />
        <SettingRow
          icon="images-outline"
          label="Save to Gallery"
          active={media}
          busy={busyKey === "media"}
          onPress={handleGallery}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  label: { flex: 1, fontSize: 14, fontWeight: "700", color: THEME.colors.text },
  div: { height: 1, backgroundColor: THEME.colors.divider, marginLeft: 44 },
  onBadge: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  onText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
