import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const STORAGE_KEY = 'yokdil_notification_prefs';
const CHANNEL_ID  = 'study-reminder';

export interface NotificationPrefs {
  enabled: boolean;
  hour: number;
  minute: number;
}

const DEFAULT_PREFS: NotificationPrefs = { enabled: false, hour: 20, minute: 0 };

// Expo Go'da scheduled notifications çalışmaz, sessizce atla
const isExpoGo = Constants.executionEnvironment === 'storeClient';

async function getNotifications() {
  const mod = await import('expo-notifications');
  return mod;
}

export async function requestPermission(): Promise<boolean> {
  if (isExpoGo) return false;
  try {
    const N = await getNotifications();
    const { status: existing } = await N.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await N.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

export async function loadPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotificationPrefs) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export async function scheduleDailyReminder(
  prefs: NotificationPrefs,
  goalMin: number,
): Promise<void> {
  if (isExpoGo) return;
  try {
    const N = await getNotifications();
    await N.cancelAllScheduledNotificationsAsync();
    if (!prefs.enabled) return;

    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Çalışma Hatırlatıcısı',
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6C63FF',
      });
    }

    const goalText = goalMin > 0
      ? `Bugünkü ${goalMin} dk hedefini tamamlamayı unutma!`
      : 'Biraz çalışmak için harika bir gün!';

    await N.scheduleNotificationAsync({
      content: {
        title: '📚 Çalışma zamanı!',
        body:  goalText,
        sound: true,
        ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DAILY,
        hour:   prefs.hour,
        minute: prefs.minute,
      },
    });
  } catch { /* sessizce başarısız ol */ }
}

export async function cancelReminder(): Promise<void> {
  if (isExpoGo) return;
  try {
    const N = await getNotifications();
    await N.cancelAllScheduledNotificationsAsync();
  } catch { /* sessizce */ }
}
