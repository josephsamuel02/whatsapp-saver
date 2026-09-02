import { Tabs, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View, Text } from "react-native";
import { THEME } from "../../constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: THEME.colors.waTeal },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "800", fontSize: 16 },
        tabBarActiveTintColor: THEME.colors.waTeal,
        tabBarInactiveTintColor: THEME.colors.textMuted,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: THEME.colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        headerTitleAlign: "left",
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="images"
        options={{
          title: "Images",
          headerTitle: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="image" size={16} color="#fff" />
              </View>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: -0.3 }}>Images</Text>
            </View>
          ),
          headerRight: () => (
            <Link href="/privacy" asChild>
              <Pressable style={{ marginRight: 14, padding: 6, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999 }}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
              </Pressable>
            </Link>
          ),
          tabBarLabel: "Images",
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "image" : "image-outline"} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: "Videos",
          headerTitle: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="videocam" size={16} color="#fff" />
              </View>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: -0.3 }}>Videos</Text>
            </View>
          ),
          headerRight: () => (
            <Link href="/privacy" asChild>
              <Pressable style={{ marginRight: 14, padding: 6, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999 }}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
              </Pressable>
            </Link>
          ),
          tabBarLabel: "Videos",
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "videocam" : "videocam-outline"} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          headerTitle: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="bookmark" size={16} color="#fff" />
              </View>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: -0.3 }}>Saved</Text>
            </View>
          ),
          headerRight: () => (
            <Link href="/privacy" asChild>
              <Pressable style={{ marginRight: 14, padding: 6, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999 }}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
              </Pressable>
            </Link>
          ),
          tabBarLabel: "Saved",
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "bookmark" : "bookmark-outline"} size={22} color={color} />,
        }}
      />
      {/* hidden index redirect tab */}
      <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
