import { useEffect, useState } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as MediaLibrary from "expo-media-library";

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function ensurePermissions() {
      if (Platform.OS !== "android") {
        if (mounted) setReady(true);
        return;
      }

      try {
        const permission = await MediaLibrary.getPermissionsAsync();
        if (!permission.granted) {
          await MediaLibrary.requestPermissionsAsync();
        }
      } catch (error) {
        console.warn("Media permission request failed:", error);
      } finally {
        if (mounted) setReady(true);
      }
    }

    ensurePermissions();

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#25D366",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="privacy"
          options={{
            presentation: "modal",
            headerShown: true,
            title: "Privacy Policy",
            headerStyle: { backgroundColor: "#25D366" },
            headerTintColor: "#fff",
          }}
        />
      </Stack>
    </>
  );
}
