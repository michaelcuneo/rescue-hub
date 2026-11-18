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

// AWS Location Places Storage-mode hints are reused only for this signed-in session.

export default function RescueAddress({
  id, latitude, longitude, location, compact = false, showDirections = false
}: Props) {
  const [value, setValue] = useState<RescueAddressResult | null>(null);
  const [loading, setLoading] = useState(true);
  const fallback = locationFallback(location);
  const directions = rescueDirectionsUrl({ latitude, longitude });

  useEffect(() => {
    let active = true;
    setValue(null);
    setLoading(true);
    void getRescueAddress(id, latitude, longitude).catch(() => null).then(result => {
      if (!active) return;
      setValue(result);
      setLoading(false);
    });
    return () => { active = false; };
  }, [id, latitude, longitude]);

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
      {value?.address && <Pressable accessibilityRole="link"
        accessibilityLabel="Amazon Location Service data sources and attribution"
        onPress={() => void Linking.openURL('https://docs.aws.amazon.com/location/latest/developerguide/data-attribution.html')}>
        <Text style={styles.note}>Address data: Amazon Location sources</Text>
      </Pressable>}
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
