import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  ActivityIndicator,
  AppState,
  Alert,
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
import { decodeSAFUri } from "../../lib/statusService";

function isBizUri(u: string): boolean {
  return u.includes("w4b") || u.includes("business");
}

function isWaUri(u: string): boolean {
  return u.includes("com.whatsapp") && !u.includes("w4b") && !u.includes("business");
}

function SettingRow({
  icon,
  label,
  subtitle,
  active,
  busy,
  onPress,
}: {
  icon: any;
  label: string;
  subtitle?: string;
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
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        {subtitle ? (
          <Text style={s.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
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
  const [waPath, setWaPath] = useState<string | undefined>(undefined);
  const [waBizPath, setWaBizPath] = useState<string | undefined>(undefined);
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
      const waUri = (uris || []).find((u, i) => isWaUri(lower[i]));
      const bizUri = (uris || []).find((u, i) => isBizUri(lower[i]));
      setWaFolder(!!waUri);
      setWaBizFolder(!!bizUri);
      setWaPath(waUri ? decodeSAFUri(waUri) : undefined);
      setWaBizPath(bizUri ? decodeSAFUri(bizUri) : undefined);
    } catch {
      setDirect(false);
      setWaFolder(false);
      setWaBizFolder(false);
      setWaPath(undefined);
      setWaBizPath(undefined);
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
      const { granted, uri } = await requestSAFPermission(kind);
      if (!granted) return;
      await load();
      if (uri) {
        let decoded = uri;
        try { decoded = decodeURIComponent(uri).toLowerCase(); } catch { }
        const pickedBiz = isBizUri(decoded);
        const pickedWa = isWaUri(decoded);
        const expected = kind === "biz"
          ? "Android → media → com.whatsapp.w4b → WhatsApp Business → Media → .Statuses"
          : "Android → media → com.whatsapp → WhatsApp → Media → .Statuses";
        if (kind === "biz" && !pickedBiz) {
          Alert.alert(
            "Wrong folder?",
            `That looks like the regular WhatsApp folder, not Business.\n\nFor Business pick:\n${expected}`,
            [{ text: "OK" }]
          );
        } else if (kind === "wa" && !pickedWa) {
          Alert.alert(
            "Wrong folder?",
            `That doesn't look like the regular WhatsApp folder.\n\nFor WhatsApp pick:\n${expected}`,
            [{ text: "OK" }]
          );
        }
        try {
          const uris = await getGrantedSAFUris();
          const lowers = uris.map((u) => {
            try { return decodeURIComponent(u).toLowerCase(); } catch { return u.toLowerCase(); }
          });
          const waCount = lowers.filter((u) => isWaUri(u)).length;
          const bizCount = lowers.filter((u) => isBizUri(u)).length;
          if (waCount > 0 && bizCount > 0) {
            const waUris = uris.filter((_, i) => isWaUri(lowers[i]));
            const bizUris = uris.filter((_, i) => isBizUri(lowers[i]));
            if (waUris.some((u) => bizUris.includes(u))) {
              Alert.alert(
                "Same folder for both",
                "WhatsApp and WhatsApp Business are pointing at the same folder. Pick each app's own .Statuses folder to see separate statuses.",
                [{ text: "OK" }]
              );
            }
          }
        } catch { }
      }
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
          subtitle={waPath ? `…/${waPath.split("/").slice(-3).join("/")}` : "Not granted — tap to pick"}
          active={waFolder}
          busy={busyKey === "wa"}
          onPress={() => pickFolder("wa")}
        />
        <View style={s.div} />
        <SettingRow
          icon="briefcase-outline"
          label="WhatsApp Business Folder"
          subtitle={waBizPath ? `…/${waBizPath.split("/").slice(-3).join("/")}` : "Not granted — tap to pick"}
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
  label: { fontSize: 14, fontWeight: "700", color: THEME.colors.text },
  subtitle: { fontSize: 11.5, color: THEME.colors.textSecondary, marginTop: 2 },
  div: { height: 1, backgroundColor: THEME.colors.divider, marginLeft: 44 },
  onBadge: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  onText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
