import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as MediaLibrary from "expo-media-library";
import { THEME } from "../constants/theme";

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function init() {
      // Light initialization - don't block on permissions, screens handle their own flows
      // Just ensure MediaLibrary is warmed up so first picker is faster
      if (Platform.OS === "android") {
        try {
          // Trigger permission state fetch (no request) so OS caches
          await MediaLibrary.getPermissionsAsync().catch(() => null);
        } catch {}
      }
      if (mounted) setReady(true);
    }
    // Minimum splash duration for branding
    const t = setTimeout(init, 420);
    return () => { mounted = false; clearTimeout(t); };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: THEME.colors.waTeal, gap: 12 }}>
        <View style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 28 }}>💬</Text>
        </View>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: -0.3 }}>Status Saver</Text>
        <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: "600" }}>for WhatsApp • Business • GB • FM</Text>
        <ActivityIndicator size="small" color="#fff" style={{ marginTop: 8 }} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={THEME.colors.waTeal} />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="privacy"
          options={{
            presentation: "modal",
            headerShown: true,
            title: "Privacy Policy",
            headerStyle: { backgroundColor: THEME.colors.waTeal },
            headerTintColor: "#fff",
            headerTitleStyle: { fontWeight: "800" },
          }}
        />
      </Stack>
    </>
  );
}
