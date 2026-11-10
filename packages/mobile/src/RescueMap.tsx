import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getDeviceMapPosition, MAPBOX_LOCATION_CONTROL, MAPBOX_LOCATION_CONTROL_CSS } from './map-location';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { type Rescue } from './api';
import { pinForRescue, RESCUE_PIN_GROUPS, type RescuePinGroup } from './rescue-pins';

type Props = { rescues: Rescue[]; onSelect: (rescue: Rescue) => void };
type MapConfiguration = { token: string; style: string; operatingAreasUrl: string };

// These are public client-side values, injected by Expo/Metro at bundle time.
// Mapbox never needs an authenticated Rescue Hub API route to obtain its public token.
const API_ORIGIN = (process.env.EXPO_PUBLIC_RESCUE_HUB_API_URL ?? '').replace(/\/$/, '');
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
<style>html,body,#map{padding:0;margin:0;width:100%;height:100%;overflow:hidden;background:#e2ebe5}.mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right{display:none}.pin{position:relative;width:42px;height:42px;box-sizing:border-box;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px #0004,0 0 0 1px #0002;display:grid;place-items:center;cursor:pointer;transition:transform 120ms,box-shadow 120ms}.pin span{color:#fff;font:900 11px system-ui;letter-spacing:-.03em}.pin.selected{transform:scale(1.12);box-shadow:0 3px 11px #0005,0 0 0 3px #ffffffa6}.pin .status-dot{position:absolute;right:-3px;bottom:-3px;width:12px;height:12px;box-sizing:border-box;border-radius:50%;border:2px solid #fff;background:#e9af34}.pin .status-dot.assigned{background:#276cd0}.user-location{width:18px;height:18px;box-sizing:border-box;border-radius:50%;background:#2679eb;border:3px solid white;box-shadow:0 0 0 9px #2679eb33,0 2px 8px #0004}.mapboxgl-popup-content{font:13px system-ui;color:#173d2c;padding:11px 13px;border-radius:10px}${MAPBOX_LOCATION_CONTROL_CSS}</style>
</head><body><div id="map"></div>
<script src="https://api.mapbox.com/mapbox-gl-js/v3.16.0/mapbox-gl.js"></script>
<script>
(function(){
const send = (message) => window.ReactNativeWebView?.postMessage(JSON.stringify(message));
if (!window.mapboxgl) { send({type:'error', message:'Mapbox could not load.'}); return; }
mapboxgl.accessToken = ${token};
const map = new mapboxgl.Map({container:'map',style:${style},center:[151.7,-32.93],zoom:9,attributionControl:false});
map.addControl(new mapboxgl.NavigationControl({showCompass:false}), 'top-right');
${MAPBOX_LOCATION_CONTROL}
const markers = new window.Map();
let records = [];
let lastPayload = '';
let hasFitted = false;
let selectedId = null;
let locationMarker = null;
window.showUserLocation = function(longitude, latitude) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
  if (locationMarker) locationMarker.remove();
  const dot = document.createElement('div');
  dot.className='user-location';
  dot.setAttribute('aria-label', 'Your location');
  locationMarker = new mapboxgl.Marker({element: dot}).setLngLat([longitude, latitude]).addTo(map);
  map.flyTo({center:[longitude,latitude],zoom:Math.max(map.getZoom(),12)});
};
function display(items){
  const nextPayload = JSON.stringify(items);
  if (nextPayload === lastPayload) return;
  lastPayload = nextPayload;
  records = items.filter(x => Number.isFinite(x.latitude) && Number.isFinite(x.longitude) && Math.abs(x.latitude)<=90 && Math.abs(x.longitude)<=180);
  markers.forEach(marker => marker.remove()); markers.clear();
  const bounds = new mapboxgl.LngLatBounds();
  for(const rescue of records){
    const element=document.createElement('div');element.className='pin';
    element.style.backgroundColor=rescue.color;
    const symbol=document.createElement('span');
    symbol.textContent=rescue.initials;
    element.appendChild(symbol);
    const dot=document.createElement('span');
    dot.className='status-dot'+(rescue.status==='PENDING'?'':' assigned');
    dot.setAttribute('aria-hidden','true');
    element.appendChild(dot);
    if(rescue.id===selectedId)element.classList.add('selected');
    element.setAttribute('role','button');
    element.setAttribute('tabindex','0');
    element.setAttribute('aria-label',rescue.type+' rescue, '+rescue.status.toLowerCase());
    const marker=new mapboxgl.Marker({element}).setLngLat([rescue.longitude,rescue.latitude]).addTo(map);
    const select=()=>{
      selectedId=rescue.id;
      for(const entry of markers.values())entry.getElement().classList.toggle('selected',entry.getElement()===element);
      map.flyTo({center:[rescue.longitude,rescue.latitude],zoom:Math.max(map.getZoom(),12)});
      send({type:'select',id:rescue.id});
    };
    element.addEventListener('click',select);
    element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}});
    markers.set(rescue.id,marker);bounds.extend([rescue.longitude,rescue.latitude]);
  }
  // Only fit once. Live polling must not reset the rescuer's current zoom/pan.
  if(records.length && !hasFitted){map.fitBounds(bounds,{padding:55,maxZoom:12,duration:450});hasFitted=true;}
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
  const locatingRef = useRef(false);
  const [locationError, setLocationError] = useState('');
  // WebView 14.0.1 defaults its props generic to undefined, making JSX props 'never'.
  // Explicitly instantiate with an empty extension until the library type fix ships.
  const map = useRef<WebView<{}>>(null);
  const source = useMemo(() => ({ html: html(MAP_CONFIGURATION), baseUrl: API_ORIGIN || 'https://api.mapbox.com' }), []);
  const payload = useMemo(() => JSON.stringify(rescues.map(r => ({
    id:r.id, type:r.type, status:r.status, latitude:r.latitude, longitude:r.longitude,
    ...pinForRescue(r)
  }))), [rescues]);

  useEffect(() => {
    if(ready) map.current?.injectJavaScript(`window.receiveRescues(${payload});true;`);
  }, [ready, payload]);

  const activeGroups = useMemo(() => {
    const keys = new Set<RescuePinGroup>(rescues.map(rescue => pinForRescue(rescue).group));
    return (Object.keys(RESCUE_PIN_GROUPS) as RescuePinGroup[]).filter(key => keys.has(key));
  }, [rescues]);

  const locateMe = async (quiet = false) => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    if (!quiet) setLocationError('');
    try {
      const position = await getDeviceMapPosition();
      if (!position) {
        if (!quiet) setLocationError('Location access is off. Enable it in device settings, or browse the map manually.');
        return;
      }
      map.current?.injectJavaScript(`window.showUserLocation(${position.longitude},${position.latitude});true;`);
    } catch (e) {
      if (!quiet) setLocationError(e instanceof Error ? e.message : 'Could not determine device location.');
    } finally {
      locatingRef.current = false;
    }
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type:string; id?:string; message?:string };
      if(message.type==='ready') {
        setReady(true);
        // Automatically centre once the map loads; a prior OS grant is reused.
        void locateMe(true);
      }
      if(message.type==='locate') void locateMe();
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
    <WebView<{}> ref={map} source={source}
      style={styles.webview} onMessage={handleMessage} javaScriptEnabled domStorageEnabled
      originWhitelist={['https://*']} onError={e=>setError(e.nativeEvent.description)}
      accessibilityLabel="Map of eligible and assigned rescue locations" />
    {!ready && !error ? <View style={styles.loading}><ActivityIndicator /><Text style={styles.hint}>Loading rescue map…</Text></View> : null}
    {error ? <View style={styles.warning}><Text style={styles.error}>{error}</Text></View> : null}
    {locationError ? <View style={styles.locationWarning}><Text style={styles.error}>{locationError}</Text></View> : null}
    <View style={styles.legend} accessibilityLabel="Animal group map legend">
      {activeGroups.map(key => <View style={styles.legendItem} key={key}>
        <View style={[styles.legendDot, { backgroundColor: RESCUE_PIN_GROUPS[key].color }]} />
        <Text style={styles.legendText}>{RESCUE_PIN_GROUPS[key].label}</Text>
      </View>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
 container:{flex:1,overflow:'hidden',backgroundColor:'#dce6df'},
 webview:{flex:1,backgroundColor:'#dce6df'},
 loading:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',gap:8},
 feedback:{margin:16,padding:15,backgroundColor:'#fff',borderRadius:12},
 hint:{color:'#53695d',fontSize:13},
 warning:{position:'absolute',top:8,left:8,right:8,padding:8,backgroundColor:'#fff8ee',borderRadius:8},
 error:{color:'#9a3b2e',fontSize:12},
 locationWarning:{position:'absolute',bottom:16,left:12,right:60,backgroundColor:'#fff',padding:10,borderRadius:9},
 legend:{position:'absolute',top:10,left:10,backgroundColor:'#fffffff0',borderRadius:10,padding:9,gap:5,maxWidth:168},
 legendItem:{flexDirection:'row',gap:7,alignItems:'center'},
 legendDot:{height:10,width:10,borderRadius:5,borderWidth:1,borderColor:'#fff'},
 legendText:{color:'#173d2c',fontSize:11,fontWeight:'700'}
});
