import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text } from "react-native";
import { THEME } from "../../constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#25D366" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "800", fontSize: 16 },
        tabBarActiveTintColor: "#25D366",
        tabBarInactiveTintColor: THEME.colors.textMuted,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: THEME.colors.border,
          height: 92,
          paddingBottom: 16,
          paddingTop: 10,
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarLabelStyle: { fontSize: 13, fontWeight: "800", marginTop: 4, letterSpacing: 0.2 },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarActiveBackgroundColor: "rgba(37,211,102,0.12)",
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
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="images" size={16} color="#fff" />
              </View>
              <Text
                style={{ color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: -0.3 }}
              >
                Images
              </Text>
            </View>
          ),
          tabBarLabel: "Images",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "images" : "images-outline"} size={30} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: "Videos",
          headerTitle: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="videocam" size={16} color="#fff" />
              </View>
              <Text
                style={{ color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: -0.3 }}
              >
                Videos
              </Text>
            </View>
          ),
          tabBarLabel: "Videos",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "videocam" : "videocam-outline"}
              size={30}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          headerTitle: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="bookmark" size={16} color="#fff" />
              </View>
              <Text
                style={{ color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: -0.3 }}
              >
                Saved
              </Text>
            </View>
          ),
          tabBarLabel: "Saved",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "bookmark" : "bookmark-outline"}
              size={30}
              color={color}
            />
          ),
        }}
      />
      {/* hidden index redirect tab */}
      <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
