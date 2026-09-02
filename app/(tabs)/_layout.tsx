import { Tabs, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { THEME } from "../../constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: THEME.colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: THEME.colors.primary,
        tabBarInactiveTintColor: THEME.colors.textMuted,
        tabBarStyle: { display: "none" },
        headerRight: () => (
          <Link href="/privacy" asChild>
            <Pressable style={{ marginRight: 16, padding: 4 }}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#fff" />
            </Pressable>
          </Link>
        ),
      }}
    >
      <Tabs.Screen
        name="images"
        options={{
          title: "Images",
          headerTitle: "Status Saver",
          tabBarLabel: "Images",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="image-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: "Videos",
          headerTitle: "Status Saver",
          tabBarLabel: "Videos",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="videocam-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
