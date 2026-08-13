import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Platform, RefreshControl, ScrollView, Pressable, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { THEME } from '../../constants/theme';
import { listStatuses, StatusFile } from '../../lib/statusService';
import { StatusGrid } from '../../components/StatusGrid';
import { PreviewModal } from '../../components/PreviewModal';

export default function VideosScreen() {
  const [files, setFiles] = useState<StatusFile[]>([]);
  const [perm, setPerm] = useState<any | null>(null);
  const [selected, setSelected] = useState<StatusFile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (Platform.OS !== 'android') return;
    const p = await MediaLibrary.getPermissionsAsync();
    setPerm(p);
    if (!p.granted) return;
    setFiles(listStatuses('video'));
  }

  useFocusEffect(useCallback(() => { load(); }, []));
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }
  async function requestPerm() {
    const r = await MediaLibrary.requestPermissionsAsync();
    setPerm(r);
    if (r.granted) load();
    else if (!r.canAskAgain) Linking.openSettings();
  }

  if (Platform.OS !== 'android') {
    return (
      <View style={s.center}>
        <Ionicons name="phone-portrait-outline" size={48} color={THEME.colors.textMuted} />
        <Text style={s.title}>Available on Android only</Text>
        <Text style={s.sub}>iOS cannot access WhatsApp files.</Text>
      </View>
    );
  }
  if (perm && !perm.granted) {
    return (
      <View style={s.center}>
        <Ionicons name="folder-open-outline" size={48} color={THEME.colors.textMuted} />
        <Text style={s.title}>Storage permission needed</Text>
        <Text style={s.sub}>Allow access to read WhatsApp statuses.</Text>
        <Pressable onPress={requestPerm} style={s.btn}><Text style={s.btnText}>Allow Access</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.colors.primary} />}>
        <View style={s.hint}>
          <Ionicons name="information-circle-outline" size={16} color={THEME.colors.textSecondary} />
          <Text style={s.hintText}>Videos are larger — allow a second to load. Pull to refresh.</Text>
        </View>
        <View style={{ flex: 1 }}>
          <StatusGrid data={files} onPress={setSelected} emptyText="No video statuses found. View a status in WhatsApp, then pull to refresh." />
        </View>
      </ScrollView>
      <PreviewModal file={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10, backgroundColor: THEME.colors.background },
  title: { fontSize: 18, fontWeight: '700', color: THEME.colors.text },
  sub: { fontSize: 14, color: THEME.colors.textSecondary, textAlign: 'center' },
  btn: { marginTop: 12, backgroundColor: THEME.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  btnText: { color: '#fff', fontWeight: '700' },
  hint: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fff', margin: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.border },
  hintText: { flex: 1, fontSize: 12, color: THEME.colors.textSecondary },
});
