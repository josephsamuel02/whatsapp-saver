import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="privacy" options={{ presentation: 'modal', headerShown: true, title: 'Privacy Policy', headerStyle: { backgroundColor: '#075E54' }, headerTintColor: '#fff' }} />
      </Stack>
    </>
  );
}
