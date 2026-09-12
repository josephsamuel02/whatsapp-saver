import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { openAllFilesAccessSettings, requestSAFPermission } from '../lib/storageAccess';

export function EmptyAccessAction({ onChanged }: { onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handlePick() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await requestSAFPermission();
      if (r.granted) onChanged?.();
    } catch {
    } finally {
      setBusy(false);
    }
  }

  async function handleSettings() {
    try {
      await openAllFilesAccessSettings();
    } catch {
    }
  }

  return (
    <View style={s.wrap}>
      <Pressable onPress={handleSettings} style={s.primary}>
        <Ionicons name="folder-open-outline" size={17} color="#fff" />
        <Text style={s.primaryText}>Allow Storage Access</Text>
      </Pressable>
      <Pressable onPress={handlePick} disabled={busy} style={[s.secondary, busy && { opacity: 0.65 }]}>
        {busy ? (
          <ActivityIndicator color={THEME.colors.primary} size="small" />
        ) : (
          <Ionicons name="folder-outline" size={16} color={THEME.colors.primary} />
        )}
        <Text style={s.secondaryText}>Pick the .Statuses folder</Text>
      </Pressable>
      <Text style={s.note}>Already granted? View a status in WhatsApp first, then pull to refresh.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: '100%', gap: 8, marginTop: 4 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  primaryText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  secondaryText: { fontSize: 13, fontWeight: '800', color: THEME.colors.primary },
  note: { fontSize: 11.5, color: THEME.colors.textSecondary, textAlign: 'center', lineHeight: 16 },
});
