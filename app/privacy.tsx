import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { THEME } from '../constants/theme';
import { PRIVACY_POLICY } from '../constants/privacy';

export default function PrivacyScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: THEME.colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.appName}>{PRIVACY_POLICY.appName}</Text>
        <Text style={styles.updated}>Last updated: {PRIVACY_POLICY.lastUpdated}</Text>
      </View>

      {PRIVACY_POLICY.sections.map((sec) => (
        <View key={sec.title} style={styles.card}>
          <Text style={styles.title}>{sec.title}</Text>
          <Text style={styles.body}>{sec.body}</Text>
        </View>
      ))}

      <Text style={styles.footer}>
        This policy is also available offline inside the app. WhatsApp is a trademark of Meta Platforms, Inc.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  appName: { fontSize: 20, fontWeight: '800', color: THEME.colors.primary },
  updated: { marginTop: 4, fontSize: 12, color: THEME.colors.textMuted },
  title: { fontSize: 15, fontWeight: '700', color: THEME.colors.text, marginBottom: 6 },
  body: { fontSize: 13, color: THEME.colors.textSecondary, lineHeight: 19 },
  footer: { fontSize: 11, color: THEME.colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 16 },
});
