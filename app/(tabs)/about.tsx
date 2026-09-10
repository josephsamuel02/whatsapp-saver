import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { THEME } from "../../constants/theme";
import { PRIVACY_POLICY } from "../../constants/privacy";

export default function AboutScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: THEME.colors.background }}
      contentContainerStyle={{ padding: 12, paddingBottom: 28, gap: 12 }}
    >
      <View style={s.card}>
        <Text style={s.cardTitle}>About Us</Text>
        <Text style={s.secBody}>
          Status Saver for WhatsApp • v1.1.0{"\n"}Not affiliated with WhatsApp
          or Meta Platforms, Inc. Only save statuses with the poster's
          permission.
        </Text>
      </View>

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
  updated: { fontSize: 12, color: THEME.colors.textMuted, fontWeight: "600" },
  secTitle: { fontSize: 13.5, fontWeight: "800", color: THEME.colors.text, marginTop: 6 },
  secBody: { fontSize: 12.5, color: THEME.colors.textSecondary, lineHeight: 19 },
});
