import { useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { THEME } from "../../constants/theme";

function TopMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function go(path: "/(tabs)/settings" | "/(tabs)/about") {
    setOpen(false);
    router.push(path as any);
  }

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        hitSlop={12}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={m.overlay} onPress={() => setOpen(false)}>
          <View style={m.menu}>
            <Pressable
              onPress={() => go("/(tabs)/settings")}
              style={({ pressed }) => [m.item, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="settings-outline" size={18} color={THEME.colors.text} />
              <Text style={m.itemText}>Settings</Text>
            </Pressable>
            <View style={m.div} />
            <Pressable
              onPress={() => go("/(tabs)/about")}
              style={({ pressed }) => [m.item, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="information-circle-outline" size={18} color={THEME.colors.text} />
              <Text style={m.itemText}>About Us</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.18)", alignItems: "flex-end", paddingTop: 56, paddingRight: 12 },
  menu: { backgroundColor: "#fff", borderRadius: 12, paddingVertical: 6, minWidth: 170, elevation: 6, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  itemText: { fontSize: 14, fontWeight: "700", color: "#111B21" },
  div: { height: 1, backgroundColor: "#E9EDEF" },
});

function HeaderTitle({ icon, label }: { icon: any; label: string }) {
  return (
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
        <Ionicons name={icon} size={16} color="#fff" />
      </View>
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: -0.3 }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: THEME.colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "800", fontSize: 16 },
        headerRight: () => <TopMenu />,
        tabBarActiveTintColor: THEME.colors.primary,
        tabBarInactiveTintColor: THEME.colors.textMuted,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: THEME.colors.border,
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "800", marginTop: 2, letterSpacing: 0.2 },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarActiveBackgroundColor: "rgba(21,149,82,0.10)",
        headerTitleAlign: "left",
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="images"
        options={{
          title: "Images",
          headerTitle: () => <HeaderTitle icon="images" label="Images" />,
          tabBarLabel: "Images",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "images" : "images-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: "Videos",
          headerTitle: () => <HeaderTitle icon="videocam" label="Videos" />,
          tabBarLabel: "Videos",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "videocam" : "videocam-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          headerTitle: () => <HeaderTitle icon="folder" label="Saved" />,
          tabBarLabel: "Saved",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "folder" : "folder-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerTitle: () => <HeaderTitle icon="settings" label="Settings" />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: "About Us",
          headerTitle: () => <HeaderTitle icon="information-circle" label="About Us" />,
          href: null,
        }}
      />
    </Tabs>
  );
}
