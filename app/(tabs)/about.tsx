import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { THEME } from "../../constants/theme";

export default function AboutScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: THEME.colors.background }}
      contentContainerStyle={{ padding: 12, paddingBottom: 28, gap: 12 }}
    >
      <View style={s.card}>
        <Text style={s.cardTitle}>About Us</Text>
        <Text style={s.secBody}>
          Status Saver for WhatsApp • v1.1.2{"\n"}Not affiliated with WhatsApp
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
  secBody: { fontSize: 12.5, color: THEME.colors.textSecondary, lineHeight: 19 },
});
