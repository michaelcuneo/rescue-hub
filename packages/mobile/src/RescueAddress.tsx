import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { getRescueAddress, type RescueAddressResult } from './api';
import {
  addressPrecisionLabel, formatRescueCoordinates, locationFallback,
  rescueDirectionsUrl
} from '../../core/rescue-location';

type Props = {
  id: string; latitude: number; longitude: number;
  location?: string | null; showDirections?: boolean; compact?: boolean;
};

// Temporary in-memory lookup cache, deliberately not persisted; coordinate
// navigation remains available even while Mapbox reverse geocoding is offline.
const resolved = new Map<string, RescueAddressResult>();
const inFlight = new Map<string, Promise<RescueAddressResult | null>>();
const keyFor = (id: string, latitude: number, longitude: number) =>
  `${id}:${latitude.toFixed(6)}:${longitude.toFixed(6)}`;

async function fetchAddress(id: string, key: string) {
  if (resolved.has(key)) return resolved.get(key)!;
  if (inFlight.has(key)) return inFlight.get(key)!;
  const request = getRescueAddress(id).then(value => {
    if (resolved.size >= 250) resolved.delete(resolved.keys().next().value!);
    resolved.set(key, value);
    return value;
  }).catch(() => null).finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

export default function RescueAddress({
  id, latitude, longitude, location, compact = false, showDirections = false
}: Props) {
  const key = keyFor(id, latitude, longitude);
  const [value, setValue] = useState<RescueAddressResult | null>(resolved.get(key) ?? null);
  const [loading, setLoading] = useState(!resolved.has(key));
  const fallback = locationFallback(location);
  const directions = rescueDirectionsUrl({ latitude, longitude });

  useEffect(() => {
    let active = true;
    setValue(resolved.get(key) ?? null);
    setLoading(!resolved.has(key));
    void fetchAddress(id, key).then(result => {
      if (!active) return;
      setValue(result);
      setLoading(false);
    });
    return () => { active = false; };
  }, [id, key]);

  return <View style={styles.wrapper}>
    <Text style={styles.address} accessibilityLabel="Mapped rescue location">
      {value?.address || fallback}
    </Text>
    {!compact && <>
      <Text style={styles.note}>
        {value?.address ? addressPrecisionLabel(value.precision) :
          loading ? 'Looking up nearest mapped address…' :
          'No reliable address. Follow the GPS pin.'}
      </Text>
      <Text style={styles.coordinates}>GPS {formatRescueCoordinates({ latitude, longitude })}</Text>
    </>}
    {showDirections && directions ? (
      <Pressable accessibilityRole="link" accessibilityLabel="Directions to exact rescue GPS location"
        style={styles.directions} onPress={() => void Linking.openURL(directions)}>
        <Text style={styles.directionsText}>DIRECTIONS</Text>
      </Pressable>
    ) : null}
  </View>;
}
const styles = StyleSheet.create({
  wrapper: { gap: 4, marginTop: 5 },
  address: { color: '#253542', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  note: { color: '#506171', fontSize: 12, lineHeight: 17 },
  coordinates: { color: '#506171', fontSize: 12, lineHeight: 17 },
  directions: { borderRadius: 9, backgroundColor: '#205e45', padding: 12,
    alignItems: 'center', marginTop: 7, minHeight: 44, justifyContent: 'center' },
  directionsText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: .4 }
});
