import * as Location from 'expo-location';

export type MapPosition = { latitude: number; longitude: number };

/**
 * Ask for foreground permission only when the OS still allows a prompt.
 * Subsequent map openings use the existing grant automatically.
 * No background permission or continuous tracking is requested.
 */
export async function getDeviceMapPosition(): Promise<MapPosition | null> {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted' && permission.canAskAgain) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== 'granted') return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced
  });
  const { latitude, longitude } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error('Current device location is unavailable.');
  }
  return { latitude, longitude };
}
