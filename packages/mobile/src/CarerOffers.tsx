import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getDeviceMapPosition } from './map-location';
import {
  acceptAnimalTransfer, claimAvailableCare, getAnimalHistory, getCareOffers,
  type Animal, type CareOffer, type CareReservation
} from './api';

type Props = { onBack: () => void; onChanged: () => void };
type Mode = 'CURRENT_LOCATION' | 'WORKPLACE' | 'OTHER';
type Place = { label: string; latitude: number; longitude: number };
const MAPBOX_TOKEN = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '').trim();

export default function CarerOffers({ onBack, onChanged }: Props) {
  const [offers, setOffers] = useState<CareOffer[]>([]);
  const [mine, setMine] = useState<CareReservation[]>([]);
  const [animals, setAnimals] = useState<Record<string, Animal>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('CURRENT_LOCATION');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<Place | null>(null);
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    const result = await getCareOffers();
    setOffers(result.items);
    setMine(result.mine);
    // The animal details request is separately tenant-authorised by the API.
    const updated = await Promise.all(result.mine.map(async item => {
      try { return [item.animalId, (await getAnimalHistory(item.animalId)).animal] as const; }
      catch { return null; }
    }));
    setAnimals(Object.fromEntries(updated.filter((item): item is readonly [string, Animal] => !!item)));
  };
  useEffect(() => {
    let live = true;
    void refresh().catch(e => { if (live) setError(e instanceof Error ? e.message : 'Cannot load care offers.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const locate = async () => {
    setBusy(true); setError('');
    try {
      const point = await getDeviceMapPosition();
      if (!point) throw new Error('Allow foreground location access or select a workplace/other address.');
      const selectedLocation = { label: 'My current GPS location', ...point };
      setMode('CURRENT_LOCATION'); setCoords(selectedLocation); setAddress(selectedLocation.label);
      setResults([]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Location unavailable.'); }
    finally { setBusy(false); }
  };

  const search = async () => {
    if (address.trim().length < 3 || !MAPBOX_TOKEN.startsWith('pk.')) {
      setError('Enter a workplace or delivery address and configure Mapbox.');
      return;
    }
    setBusy(true); setError(''); setResults([]); setCoords(null);
    try {
      const params = new URLSearchParams({
        q: address.trim(), access_token: MAPBOX_TOKEN, country: 'au', limit: '5'
      });
      const response = await fetch('https://api.mapbox.com/search/geocode/v6/forward?' + params);
      if (!response.ok) throw new Error('Address search is unavailable.');
      const body = await response.json() as { features?: Array<{
        geometry?: { coordinates: [number, number] };
        properties?: { full_address?: string; name?: string; place_formatted?: string }
      }> };
      const found = (body.features ?? []).filter(feature => !!feature.geometry).map(feature => ({
        label: feature.properties?.full_address ||
          [feature.properties?.name, feature.properties?.place_formatted].filter(Boolean).join(', ') || address,
        latitude: feature.geometry!.coordinates[1], longitude: feature.geometry!.coordinates[0]
      }));
      setResults(found);
      if (!found.length) setError('No matching delivery address. Try a more precise location.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Address search failed.'); }
    finally { setBusy(false); }
  };

  const claim = async () => {
    if (!selected || !coords || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await claimAvailableCare(selected, { mode, address: coords.label,
        latitude: coords.latitude, longitude: coords.longitude });
      setNotice('You are the nominated carer. Transport is now open for a volunteer to claim. The transporter will receive your private delivery destination.');
      setSelected(null); setCoords(null); setAddress(''); setResults([]);
      await refresh(); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to claim animal care.'); }
    finally { setBusy(false); }
  };

  const accept = async (animalId: string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await acceptAnimalTransfer(animalId);
      setNotice('Animal custody acknowledged. You can now access its ongoing care record.');
      await refresh(); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to accept custody.'); }
    finally { setBusy(false); }
  };

  return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.link}>‹ Back to rescue map</Text></Pressable>
    <Text style={styles.title}>Animals needing a carer</Text>
    <Text style={styles.copy}>Claim the animal you can care for. Another volunteer can transport it to your workplace, a chosen address, or your current location. Claiming care does not claim the transport job.</Text>
    {error ? <Text role="alert" style={styles.error}>{error}</Text> : null}
    {notice ? <Text accessibilityRole="text" style={styles.notice}>{notice}</Text> : null}
    {loading ? <ActivityIndicator /> : null}
    {offers.map(offer => <View key={offer.animalId} style={styles.card}>
      <Text style={styles.heading}>{offer.species}</Text>
      <Text style={styles.copy}>At vet: {offer.clinic}</Text>
      {selected !== offer.animalId ? (
        <Pressable style={styles.button} accessibilityRole="button" onPress={() => {
          setSelected(offer.animalId); setMode('CURRENT_LOCATION'); setAddress(''); setCoords(null); setResults([]); setError('');
        }}><Text style={styles.buttonText}>I'll care for this animal · Transport to me</Text></Pressable>
      ) : <>
        <Text style={styles.heading}>Where should it be delivered?</Text>
        <View style={styles.choices}>
          {(['CURRENT_LOCATION','WORKPLACE','OTHER'] as Mode[]).map(option => (
            <Pressable key={option} style={[styles.chip, mode === option && styles.chipActive]}
              accessibilityRole="button" accessibilityState={{selected:mode===option}}
              onPress={() => { setMode(option); setCoords(null); setAddress(''); setResults([]); }}>
              <Text style={mode === option ? styles.chipTextActive : styles.chipText}>
                {option === 'CURRENT_LOCATION' ? 'My GPS' : option === 'WORKPLACE' ? 'Workplace' : 'Other place'}
              </Text>
            </Pressable>
          ))}
        </View>
        {mode === 'CURRENT_LOCATION' ? (
          <Pressable style={styles.button} disabled={busy} accessibilityRole="button" onPress={() => void locate()}>
            <Text style={styles.buttonText}>Use my current location</Text>
          </Pressable>
        ) : <>
          <TextInput style={styles.input} value={address} onChangeText={value => {
            setAddress(value); setCoords(null);
          }} placeholder={mode === 'WORKPLACE' ? 'Search your workplace address' : 'Search delivery address'}
            accessibilityLabel="Delivery address" />
          <Pressable style={styles.button} disabled={busy || address.trim().length < 3} accessibilityRole="button"
            onPress={() => void search()}><Text style={styles.buttonText}>Find address</Text></Pressable>
          {results.map((place, i) => <Pressable key={i} style={styles.result} accessibilityRole="button"
            onPress={() => { setCoords(place); setAddress(place.label); setResults([]); }}>
            <Text style={styles.link}>{place.label}</Text>
          </Pressable>)}
        </>}
        {coords ? <Text style={styles.copy}>Destination confirmed: {coords.label} ({coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)})</Text> : null}
        <Pressable style={styles.button} disabled={busy || !coords} accessibilityRole="button"
          onPress={() => void claim()}><Text style={styles.buttonText}>Confirm care & request transport to me</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setSelected(null)}><Text style={styles.link}>Cancel</Text></Pressable>
      </>}
    </View>)}
    {!loading && !offers.length ? <Text style={styles.copy}>No animals are currently awaiting a carer.</Text> : null}

    <Text style={styles.title}>Animals I've claimed for care</Text>
    {mine.map(item => <View key={item.animalId} style={styles.card}>
      <Text style={styles.heading}>{item.species}</Text>
      <Text style={styles.copy}>Status: {animals[item.animalId]?.status.replace(/_/g,' ') ?? 'Updating'}</Text>
      <Text style={styles.copy}>Transport arranged separately · Animal ID: {item.animalId}</Text>
      {animals[item.animalId]?.pendingTransferToUserId ? (
        <Pressable style={styles.button} disabled={busy} accessibilityRole="button"
          onPress={() => void accept(item.animalId)}>
          <Text style={styles.buttonText}>Accept animal custody after delivery</Text>
        </Pressable>
      ) : animals[item.animalId]?.currentCustodianUserId ? (
        <Text style={styles.copy}>Care record remains available under your existing animal care worklist after handover.</Text>
      ) : null}
    </View>)}
    <Pressable accessibilityRole="button" onPress={() => void refresh().catch(e=>setError(String(e)))}>
      <Text style={styles.link}>Refresh care offers</Text>
    </Pressable>
  </ScrollView>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#edf1ee'},content:{padding:18,paddingBottom:55,gap:12},
  title:{fontSize:24,color:'#173d2c',fontWeight:'800'},heading:{fontSize:17,fontWeight:'800',color:'#17211d'},
  copy:{fontSize:13,lineHeight:19,color:'#435249'},link:{fontWeight:'700',color:'#24583f',paddingVertical:8},
  card:{padding:16,backgroundColor:'#fff',borderRadius:14,borderWidth:1,borderColor:'#d9e1dc',gap:9},
  button:{backgroundColor:'#173d2c',borderRadius:10,padding:13,alignItems:'center'},
  buttonText:{color:'#fff',fontWeight:'800'},input:{borderWidth:1,borderColor:'#d9e1dc',borderRadius:10,padding:12,minHeight:48},
  error:{color:'#9a3b2e'},notice:{color:'#24583f',fontWeight:'700'},
  choices:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{borderRadius:10,borderWidth:1,borderColor:'#d9e1dc',padding:10},
  chipActive:{backgroundColor:'#173d2c'},chipText:{color:'#173d2c'},chipTextActive:{color:'#fff'},
  result:{borderRadius:8,borderColor:'#d9e1dc',borderWidth:1,padding:8}
});
