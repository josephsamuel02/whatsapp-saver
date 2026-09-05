import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, Platform, Image } from "react-native";
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: THEME.colors.waTeal, gap: 14 }}>
        <Image source={require("../assets/icon.png")} style={{ width: 96, height: 96, borderRadius: 20 }} resizeMode="cover" />
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18, letterSpacing: -0.3 }}>Status Saver</Text>
        <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: "600" }}>for WhatsApp • Business • GB • FM</Text>
        <ActivityIndicator size="small" color="#fff" style={{ marginTop: 8 }} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={THEME.colors.waTeal} />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
