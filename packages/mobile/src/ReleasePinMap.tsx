import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { formatReleaseCoordinates, isValidReleasePoint } from '../../core/release-location';

type Point = { latitude: number; longitude: number };
type Props = { visible: boolean; original: Point; selected: Point | null;
  onChoose: (point: Point) => void; onCancel: () => void };

function mapHtml(original: Point, selected: Point | null): string {
  const start = isValidReleasePoint(selected) ? selected : original;
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="https://unpkg.com/maplibre-gl@6.18.0/dist/maplibre-gl.css" rel="stylesheet">
<style>html,body,#map{height:100%;width:100%;margin:0;overflow:hidden;background:#edf1ee}
.release-marker{height:28px;width:28px;border:3px solid #fff;border-radius:50% 50% 50% 4px;background:#763c89;transform:rotate(-45deg)}
.origin-marker{height:15px;width:15px;border:2px solid #fff;border-radius:50%;background:#205e45}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/maplibre-gl@6.18.0/dist/maplibre-gl.js"></script>
<script>(function(){
 const send=data=>window.ReactNativeWebView?.postMessage(JSON.stringify(data));
 if(!window.maplibregl){send({type:'error',message:'MapLibre could not load'});return}
 const original = ${JSON.stringify(original)};
 const start = ${JSON.stringify(start)};
 const initial = ${JSON.stringify(selected)};
 const map = new maplibregl.Map({container:'map',
   style:'https://tiles.openfreemap.org/styles/liberty',
   center:[start.longitude,start.latitude],zoom:11});
 map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
 const origin=document.createElement('div');origin.className='origin-marker';
 new maplibregl.Marker({element:origin}).setLngLat([original.longitude,original.latitude]).addTo(map);
 let marker=null;
 function setPin(point){
   if(!point||!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude))return;
   if(marker)marker.remove();
   const el=document.createElement('div');el.className='release-marker';
   marker=new maplibregl.Marker({element:el}).setLngLat([point.longitude,point.latitude]).addTo(map);
   send({type:'pin',latitude:point.latitude,longitude:point.longitude});
 }
 if(initial)setPin(initial);
 map.on('click',e=>setPin({latitude:e.lngLat.lat,longitude:e.lngLat.lng}));
 map.on('load',()=>send({type:'ready'}));
 map.on('error',e=>send({type:'error',message:e.error?.message||'Map tiles unavailable'}));
})()</script></body></html>`;
}

export default function ReleasePinMap({ visible, original, selected, onChoose, onCancel }: Props) {
  const [pending, setPending] = useState<Point | null>(selected);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    setPending(selected);
    setReady(false);
    setError('');
  }, [visible, original.latitude, original.longitude]);
  const source = useMemo(() => ({
    html: mapHtml(original, selected), baseUrl: 'https://tiles.openfreemap.org'
  }), [original.latitude, original.longitude, selected?.latitude, selected?.longitude]);
  const receive = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string; latitude?: number; longitude?: number; message?: string
      };
      if (data.type === 'ready') setReady(true);
      if (data.type === 'error' && !ready) setError(data.message ?? 'Map tiles unavailable');
      if (data.type === 'pin') {
        const point = { latitude: data.latitude ?? NaN, longitude: data.longitude ?? NaN };
        if (isValidReleasePoint(point)) setPending(point);
      }
    } catch { /* Ignore malformed WebView messages. */ }
  };
  return <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.heading}>Choose wildlife release pin</Text>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.close}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Tap the exact forest, bushland or reserve. No street address is needed.</Text>
      <View style={styles.mapContainer}>
        {visible ? <WebView<{}> source={source} onMessage={receive} originWhitelist={['*']}
          javaScriptEnabled domStorageEnabled accessibilityLabel="Wildlife release location map" /> : null}
        {!ready && !error ? <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator/><Text>Loading MapLibre…</Text></View> : null}
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <Text style={styles.coordinates}>{pending ? formatReleaseCoordinates(pending) : 'Tap to choose a release point'}</Text>
      <View style={styles.actions}>
        <Pressable style={styles.secondary} accessibilityRole="button" onPress={() => onChoose(original)}>
          <Text style={styles.secondaryText}>Use original rescue site</Text>
        </Pressable>
        <Pressable style={[styles.primary, !pending && styles.disabled]} accessibilityRole="button"
          disabled={!pending} onPress={() => { if (pending) onChoose(pending); }}>
          <Text style={styles.primaryText}>Use release pin</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex:1, paddingTop:48, paddingHorizontal:14, paddingBottom:26, backgroundColor:'#edf1ee', gap:12 },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  heading: { flex:1, fontSize:21, fontWeight:'800', color:'#173d2c' },
  hint: { color:'#40594a', fontSize:13, lineHeight:18 },
  close: { minHeight:44, minWidth:60, justifyContent:'center', alignItems:'center' },
  closeText: { color:'#173d2c', fontWeight:'700' },
  mapContainer: { flex:1, minHeight:260, borderRadius:12, overflow:'hidden' },
  loading: { position:'absolute', top:20, left:20, right:20, padding:12, backgroundColor:'#ffffffee', borderRadius:8, flexDirection:'row', gap:12, alignItems:'center' },
  coordinates: { fontSize:14, fontWeight:'700', color:'#173d2c' },
  error: { color:'#a23f35', fontSize:13 },
  actions: { gap:9 },
  secondary: { minHeight:44, padding:11, borderWidth:1, borderColor:'#b1c9b9', borderRadius:9, backgroundColor:'#fff', alignItems:'center', justifyContent:'center' },
  secondaryText: { color:'#173d2c', fontWeight:'700', fontSize:14 },
  primary: { minHeight:48, padding:12, borderRadius:9, backgroundColor:'#173d2c', alignItems:'center', justifyContent:'center' },
  primaryText: { color:'#fff', fontWeight:'800', fontSize:15 },
  disabled: { opacity:0.45 }
});
