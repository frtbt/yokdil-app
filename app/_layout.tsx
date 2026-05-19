import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { ENDPOINTS } from '../constants/Api';
import { useAuthStore } from '../store/useAuthStore';
import { initDatabaseSilently } from '../services/db';

// Expo Go (SDK 53+) uzak bildirimleri desteklemiyor; yalnızca development/production build'lerde çalışır.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

async function registerPushToken(authToken: string | null) {
  if (isExpoGo || Platform.OS === 'web') return;

  try {
    const { default: Notifications } = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:  true,
        shouldPlaySound:  true,
        shouldSetBadge:   false,
        shouldShowBanner: true,
        shouldShowList:   true,
      }),
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync();

    await fetch(ENDPOINTS.registerToken, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ push_token: pushToken, platform: Platform.OS }),
    });
  } catch {
    // token kaydı sessizce başarısız olabilir
  }
}

export default function RootLayout() {
  const { token } = useAuthStore();

  useEffect(() => {
    initDatabaseSilently();
  }, []);

  useEffect(() => {
    registerPushToken(token);
  }, [token]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="pdf/[id]"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="profile/edit"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="study-plan/index"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="category/[slug]"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="search"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen name="exam/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="exam/results"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
