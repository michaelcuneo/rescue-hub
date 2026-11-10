import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { type Rescue } from './api';

type Props = { rescues: Rescue[]; onSelect: (rescue: Rescue) => void };
type MapConfiguration = { token: string; style: string; operatingAreasUrl: string };

// These are public client-side values, injected by Expo/Metro at bundle time.
// Mapbox never needs an authenticated Rescue Hub API route to obtain its public token.
const API_ORIGIN = (process.env.EXPO_PUBLIC_RESCUE_HUB_API_URL ?? '').replace(/\\/$/, '');
const MAPBOX_TOKEN = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '').trim();
const MAP_CONFIGURATION: MapConfiguration = {
  token: MAPBOX_TOKEN,
  style: 'mapbox://styles/michaelcuneo/ckzzecgy7005j14qvpzd53fgn',
  operatingAreasUrl: `${API_ORIGIN}/data/operating-areas.geojson`
};

function html(config: MapConfiguration) {
  // Rescue data never interpolates into executable JavaScript: it travels as JSON messages.
  const token = JSON.stringify(config.token);
  const style = JSON.stringify(config.style);
  const areas = JSON.stringify(config.operatingAreasUrl);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link href="https://api.mapbox.com/mapbox-gl-js/v3.16.0/mapbox-gl.css" rel="stylesheet">
<style>html,body,#map{padding:0;margin:0;width:100%;height:100%;overflow:hidden;background:#e2ebe5}.mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right{display:none}.pin{width:31px;height:31px;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px #0004;display:flex;align-items:center;justify-content:center;cursor:pointer}.pin span{transform:rotate(45deg);color:white;font:bold 13px system-ui}.mapboxgl-popup-content{font:13px system-ui;color:#173d2c;padding:11px 13px;border-radius:10px}</style>
</head><body><div id="map"></div>
<script src="https://api.mapbox.com/mapbox-gl-js/v3.16.0/mapbox-gl.js"></script>
<script>
(function(){
const send = (message) => window.ReactNativeWebView?.postMessage(JSON.stringify(message));
if (!window.mapboxgl) { send({type:'error', message:'Mapbox could not load.'}); return; }
mapboxgl.accessToken = ${token};
const map = new mapboxgl.Map({container:'map',style:${style},center:[151.7,-32.93],zoom:9,attributionControl:false});
map.addControl(new mapboxgl.NavigationControl({showCompass:false}), 'top-right');
const markers = new window.Map();
let records = [];
function display(items){
  records = items.filter(x => Number.isFinite(x.latitude) && Number.isFinite(x.longitude) && Math.abs(x.latitude)<=90 && Math.abs(x.longitude)<=180);
  markers.forEach(marker => marker.remove()); markers.clear();
  const bounds = new mapboxgl.LngLatBounds();
  for(const rescue of records){
    const element=document.createElement('div');element.className='pin';
    element.style.backgroundColor=rescue.status==='PENDING'?'#d65c44':'#1b6b53';
    const symbol=document.createElement('span');symbol.textContent=rescue.status==='PENDING'?'!':'✓';element.appendChild(symbol);
    element.setAttribute('aria-label',rescue.type+' rescue');
    const marker=new mapboxgl.Marker({element}).setLngLat([rescue.longitude,rescue.latitude]).addTo(map);
    element.addEventListener('click',()=>{map.flyTo({center:[rescue.longitude,rescue.latitude],zoom:Math.max(map.getZoom(),12)});send({type:'select',id:rescue.id});});
    markers.set(rescue.id,marker);bounds.extend([rescue.longitude,rescue.latitude]);
  }
  if(records.length)map.fitBounds(bounds,{padding:55,maxZoom:12,duration:450});
}
window.receiveRescues = display;
function installAreas(){
  fetch(${areas}).then(r => r.ok ? r.json() : Promise.reject(new Error('Boundaries unavailable'))).then(geo=>{
    if(map.getSource('operating-areas'))return;
    map.addSource('operating-areas',{type:'geojson',data:geo});
    map.addLayer({id:'operating-area-fill',type:'fill',source:'operating-areas',paint:{
      'fill-color':['case',['==',['get','organisationId'],'native-animal-trust-fund'],'#f2b705','#50a971'],
      'fill-opacity':['case',['==',['get','organisationId'],'native-animal-trust-fund'],0.16,0.035]}},map.getStyle().layers.find(x=>x.type==='symbol')?.id);
    map.addLayer({id:'operating-area-outline',type:'line',source:'operating-areas',paint:{
      'line-color':['case',['==',['get','organisationId'],'native-animal-trust-fund'],'#8a6200','#2d7148'],
      'line-width':['case',['==',['get','organisationId'],'native-animal-trust-fund'],2,0.8]}});
  }).catch(()=>{/* Basemap and rescue pins remain available when GIS is down. */});
}
map.on('load',()=>{installAreas();send({type:'ready'});});
map.on('error',e=>send({type:'error',message:e.error?.message||'Map error'}));
})();
</script></body></html>`;
}

export default function RescueMap({ rescues, onSelect }: Props) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  // WebView 14.0.1 defaults its props generic to undefined, making JSX props 'never'.
  // Explicitly instantiate with an empty extension until the library type fix ships.
  const map = useRef<WebView<{}>>(null);
  const payload = useMemo(() => JSON.stringify(rescues.map(r => ({
    id:r.id, type:r.type, status:r.status, latitude:r.latitude, longitude:r.longitude
  }))), [rescues]);

  useEffect(() => {
    if(ready) map.current?.injectJavaScript(`window.receiveRescues(${payload});true;`);
  }, [ready, payload]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type:string; id?:string; message?:string };
      if(message.type==='ready') setReady(true);
      if(message.type==='error') setError(message.message ?? 'Mapbox unavailable');
      if(message.type==='select'){
        const rescue = rescues.find(item => item.id===message.id);
        if(rescue) onSelect(rescue);
      }
    } catch { /* Ignore malformed WebView messages. */ }
  };

  if (!MAPBOX_TOKEN.startsWith('pk.')) {
    return <View style={styles.feedback}><Text style={styles.error}>Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in packages/mobile/.env and restart Expo.</Text></View>;
  }
  return <View style={styles.container}>
    <WebView<{}> ref={map} source={{html:html(MAP_CONFIGURATION),baseUrl:API_ORIGIN || 'https://api.mapbox.com'}}
      style={styles.webview} onMessage={handleMessage} javaScriptEnabled domStorageEnabled
      originWhitelist={['https://*']} onError={e=>setError(e.nativeEvent.description)}
      accessibilityLabel="Map of eligible and assigned rescue locations" />
    {!ready && !error ? <View style={styles.loading}><ActivityIndicator /><Text style={styles.hint}>Loading rescue map…</Text></View> : null}
    {error ? <View style={styles.warning}><Text style={styles.error}>{error}</Text></View> : null}
    <View style={styles.legend}><Text style={styles.legendText}>● Pending     ● Assigned / yours</Text></View>
  </View>;
}
const styles = StyleSheet.create({
 container:{height:320,borderRadius:16,overflow:'hidden',backgroundColor:'#dce6df',marginHorizontal:16,marginTop:14},
 webview:{flex:1,backgroundColor:'#dce6df'},
 loading:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',gap:8},
 feedback:{margin:16,padding:15,backgroundColor:'#fff',borderRadius:12},
 hint:{color:'#53695d',fontSize:13},
 warning:{position:'absolute',top:8,left:8,right:8,padding:8,backgroundColor:'#fff8ee',borderRadius:8},
 error:{color:'#9a3b2e',fontSize:12},
 legend:{position:'absolute',bottom:8,left:8,backgroundColor:'#ffffffed',borderRadius:9,padding:8},
 legendText:{color:'#173d2c',fontSize:11,fontWeight:'700'}
});
