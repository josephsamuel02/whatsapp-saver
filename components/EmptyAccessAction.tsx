import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { openAllFilesAccessSettings } from '../lib/storageAccess';

export function EmptyAccessAction() {
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
  note: { fontSize: 11.5, color: THEME.colors.textSecondary, textAlign: 'center', lineHeight: 16 },
});
