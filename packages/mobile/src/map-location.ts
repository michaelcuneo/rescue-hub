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

/**
 * Adds a familiar crosshair *inside* the native Mapbox navigation controls.
 * The WebView sends only a request; Expo owns actual location permission.
 * Include this after map.addControl(new NavigationControl(...)) in both maps.
 */
export const MAPBOX_LOCATION_CONTROL = `
map.addControl({
  onAdd: function () {
    const container = document.createElement('div');
    container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mapboxgl-ctrl-location';
    button.setAttribute('aria-label', 'Centre map on my location');
    button.setAttribute('title', 'My location');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>';
    button.addEventListener('click', function () {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'locate' }));
    });
    container.appendChild(button);
    this._container = container;
    return container;
  },
  onRemove: function () {
    this._container?.remove();
    this._container = null;
  }
}, 'top-right');
`;

export const MAPBOX_LOCATION_CONTROL_CSS =
  '.mapboxgl-ctrl-location{display:flex!important;align-items:center;justify-content:center}' +
  '.mapboxgl-ctrl-location svg{width:20px;height:20px;stroke:#333;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}';
