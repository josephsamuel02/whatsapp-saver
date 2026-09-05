import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  ActivityIndicator,
  AppState,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { THEME } from "../../constants/theme";
import { PRIVACY_POLICY } from "../../constants/privacy";
import {
  hasStoragePermission,
  hasSAFPermission,
  hasMediaLibraryPermission,
  openAllFilesAccessSettings,
  requestSAFPermission,
} from "../../lib/storageAccess";
import {
  diagnoseAccess,
  type AccessDiagnosis,
} from "../../lib/statusService";

function PermissionRow({
  icon,
  label,
  granted,
  onFix,
}: {
  icon: string;
  label: string;
  granted: boolean | null;
  onFix?: () => void;
}) {
  return (
    <View style={s.permRow}>
      <Ionicons
        name={icon as any}
        size={18}
        color={granted ? THEME.colors.primary : THEME.colors.textMuted}
      />
      <Text style={s.permLabel}>{label}</Text>
      {granted === null ? (
        <ActivityIndicator size="small" color={THEME.colors.textMuted} />
      ) : granted ? (
        <View style={s.permOk}>
          <Ionicons name="checkmark" size={13} color="#fff" />
          <Text style={s.permOkText}>On</Text>
        </View>
      ) : (
        <Pressable onPress={onFix} style={s.permFix}>
          <Text style={s.permFixText}>Enable</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const [direct, setDirect] = useState<boolean | null>(null);
  const [saf, setSaf] = useState<boolean | null>(null);
  const [media, setMedia] = useState<boolean | null>(null);
  const [safBusy, setSafBusy] = useState(false);
  const [diag, setDiag] = useState<AccessDiagnosis | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, sf, m] = await Promise.all([
        hasStoragePermission(),
        hasSAFPermission(),
        hasMediaLibraryPermission(),
      ]);
      setDirect(d);
      setSaf(sf);
      setMedia(m);
    } catch {
      setDirect(false);
      setSaf(false);
      setMedia(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setDirect(null);
      setSaf(null);
      setMedia(null);
      load();
    }, [load])
  );

  // Re-check when returning from system Settings / folder picker.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        load();
      }
    });
    return () => sub.remove();
  }, [load]);

  async function handlePickFolder() {
    if (safBusy) return;
    setSafBusy(true);
    try {
      const { granted } = await requestSAFPermission();
      if (granted) setSaf(true);
    } finally {
      setSafBusy(false);
    }
  }

  const runDiagnostics = useCallback(async () => {
    if (diagBusy) return;
    setDiagBusy(true);
    try {
      const result = await diagnoseAccess();
      setDiag(result);
    } catch {
      setDiag(null);
    } finally {
      setDiagBusy(false);
    }
  }, [diagBusy]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: THEME.colors.background }}
      contentContainerStyle={{ padding: 12, paddingBottom: 28, gap: 12 }}
    >
      {/* Permissions card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Permissions</Text>
        <Text style={s.cardSub}>
          The app works if either storage option below is enabled.
        </Text>
        <PermissionRow
          icon="folder-open-outline"
          label="Storage access (all files)"
          granted={direct}
          onFix={() => openAllFilesAccessSettings()}
        />
        <PermissionRow
          icon="document-outline"
          label="Statuses folder picked"
          granted={saf}
          onFix={handlePickFolder}
        />
        <PermissionRow
          icon="images-outline"
          label="Gallery saving"
          granted={media}
          onFix={() => Linking.openSettings()}
        />
        <Pressable
          onPress={handlePickFolder}
          disabled={safBusy}
          style={[s.pickBtn, safBusy && { opacity: 0.6 }]}
        >
          {safBusy ? (
            <ActivityIndicator color={THEME.colors.primary} size="small" />
          ) : (
            <Ionicons
              name="folder-open-outline"
              size={16}
              color={THEME.colors.primary}
            />
          )}
          <Text style={s.pickBtnText}>Pick .Statuses folder (Play-safe)</Text>
        </Pressable>
        <Text style={s.hint}>
          In the picker go to Android → media → com.whatsapp → WhatsApp → Media
          → .Statuses. Enable "Show hidden files" to see it.
        </Text>
      </View>

      {/* Diagnostics card — ground truth when the grid is empty */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Diagnostics</Text>
        <Text style={s.cardSub}>
          Empty grid? Run this — it shows exactly what the app can see.
        </Text>
        <Text style={s.hint}>
          The app scans these exact folders first — confirm they exist in
          your Files app:{"\n"}•
          /storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/.Statuses
          {"\n"}• /storage/emulated/0/Android/media/com.whatsapp.w4b/WhatsApp
          Business/Media/.Statuses
        </Text>
        <Pressable
          onPress={runDiagnostics}
          disabled={diagBusy}
          style={[s.pickBtn, diagBusy && { opacity: 0.6 }]}
        >
          {diagBusy ? (
            <ActivityIndicator color={THEME.colors.primary} size="small" />
          ) : (
            <Ionicons
              name="bug-outline"
              size={16}
              color={THEME.colors.primary}
            />
          )}
          <Text style={s.pickBtnText}>
            {diag ? "Re-run diagnostics" : "Run diagnostics"}
          </Text>
        </Pressable>
        {diag && (
          <View style={{ gap: 8 }}>
            <View style={s.diagRow}>
              <Text style={s.diagLabel}>Scan finds</Text>
              <Text style={s.diagValue}>
                {diag.totalImages} images • {diag.totalVideos} videos
              </Text>
            </View>
            <View style={s.diagRow}>
              <Text style={s.diagLabel}>All-files access</Text>
              <Text style={s.diagValue}>{diag.directAccess ? "Yes" : "No"}</Text>
            </View>
            <View style={s.diagRow}>
              <Text style={s.diagLabel}>Folders granted</Text>
              <Text style={s.diagValue}>{diag.safGrants.length}</Text>
            </View>
            {diag.safGrants.map((g, i) => (
              <View key={`${g.uri}-${i}`} style={s.diagGrant}>
                <Text style={s.diagFolder} numberOfLines={2}>
                  …/{g.folder.split("/").slice(-4).join("/")}
                </Text>
                {g.error ? (
                  <Text style={s.diagError}>Cannot read: {g.error}</Text>
                ) : (
                  <Text style={s.diagValue}>
                    {g.entries} entries • {g.files} status files
                  </Text>
                )}
                {g.samples.length > 0 && (
                  <Text style={s.diagSamples} numberOfLines={3}>
                    e.g. {g.samples.join(", ")}
                  </Text>
                )}
              </View>
            ))}
            {diag.directProbes
              .filter((d) => d.exists)
              .map((d) => (
                <View key={d.path} style={s.diagRow}>
                  <Text style={s.diagLabel} numberOfLines={1}>
                    {d.label}
                  </Text>
                  <Text style={s.diagValue}>
                    {d.error ?? `${d.media} status files`}
                  </Text>
                </View>
              ))}
            {diag.safGrants.length > 0 &&
              diag.totalImages === 0 &&
              diag.totalVideos === 0 && (
                <Text style={s.hint}>
                  A folder is granted but no statuses were found inside it.
                  You may have picked the wrong level (e.g. "Media" with
                  nothing in it), or the statuses expired (they vanish 24h
                  after posting — view one in WhatsApp, then refresh).
                </Text>
              )}
          </View>
        )}
      </View>

      {/* How to use card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>How to use</Text>
        {[
          "Open WhatsApp and view the status you want to keep.",
          "Return to Status Saver and pull to refresh.",
          "Tap a status to preview, Save it or Repost it.",
          "Long-press a status or tap its ✓ badge to select several and save them at once.",
        ].map((step, i) => (
          <View key={i} style={s.stepRow}>
            <View style={s.stepNum}>
              <Text style={s.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={s.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {/* Privacy card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Privacy Policy</Text>
        <Text style={s.updated}>
          {PRIVACY_POLICY.appName} • Last updated {PRIVACY_POLICY.lastUpdated}
        </Text>
        {PRIVACY_POLICY.sections.map((sec) => (
          <View key={sec.title} style={{ gap: 4 }}>
            <Text style={s.secTitle}>{sec.title}</Text>
            <Text style={s.secBody}>{sec.body}</Text>
          </View>
        ))}
      </View>

      {/* About card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>About</Text>
        <Text style={s.secBody}>
          Status Saver for WhatsApp • v1.1.0{"\n"}Not affiliated with WhatsApp
          or Meta Platforms, Inc. Only save statuses with the poster's
          permission.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: THEME.colors.text },
  cardSub: { fontSize: 12.5, color: THEME.colors.textSecondary, lineHeight: 18 },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
  },
  permLabel: { flex: 1, fontSize: 13, fontWeight: "700", color: THEME.colors.text },
  permOk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  permOkText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  permFix: {
    backgroundColor: "#E7F8EC",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C3F0CF",
  },
  permFixText: { color: THEME.colors.primary, fontSize: 12, fontWeight: "800" },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E7F8EC",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C3F0CF",
  },
  pickBtnText: { color: THEME.colors.primary, fontSize: 13.5, fontWeight: "800" },
  diagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
  },
  diagLabel: { flex: 1, fontSize: 13, fontWeight: "700", color: THEME.colors.text },
  diagValue: { fontSize: 12.5, color: THEME.colors.textSecondary, fontWeight: "600", textAlign: "right" },
  diagGrant: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  diagFolder: { fontSize: 12.5, fontWeight: "800", color: THEME.colors.text },
  diagError: { fontSize: 12, fontWeight: "700", color: THEME.colors.error },
  diagSamples: { fontSize: 11, color: THEME.colors.textMuted, lineHeight: 15 },
  hint: { fontSize: 11.5, color: THEME.colors.textMuted, lineHeight: 17 },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F9FAFB",
    padding: 10,
    borderRadius: 12,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  stepText: { flex: 1, color: THEME.colors.text, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  updated: { fontSize: 12, color: THEME.colors.textMuted, fontWeight: "600" },
  secTitle: { fontSize: 13.5, fontWeight: "800", color: THEME.colors.text, marginTop: 6 },
  secBody: { fontSize: 12.5, color: THEME.colors.textSecondary, lineHeight: 19 },
});
