import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { registerDevice } from './api';

export type PushRegistration = {
  status: 'REGISTERED' | 'EXPO_GO' | 'SIMULATOR' | 'DENIED' | 'MISSING_PROJECT_ID' | 'ERROR';
  message: string;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export async function registerForPushNotifications(): Promise<PushRegistration> {
  if (Constants.appOwnership === 'expo') {
    return { status: 'EXPO_GO', message: 'Expo Go cannot receive Rescue Hub remote push notifications. Install an Expo development build on this iPhone.' };
  }
  if (!Device.isDevice) {
    return { status: 'SIMULATOR', message: 'Push delivery testing requires a physical device.' };
  }
  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') {
      return { status: 'DENIED', message: 'Allow notifications for Rescue Hub in iPhone Settings.' };
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rescues', {
        name: 'Available rescues',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 150, 250]
      });
    }

    const projectId =
      Constants.easConfig?.projectId ??
      (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);

    if (!projectId) {
      return { status: 'MISSING_PROJECT_ID', message: 'Expo push needs an EAS project ID. Run eas init and configure a development build.' };
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android', Device.modelName ?? undefined);
    return { status: 'REGISTERED', message: 'This device is registered for rescue notifications.' };
  } catch (error) {
    return { status: 'ERROR', message: error instanceof Error ? error.message : 'Unable to register push notifications.' };
  }
}
