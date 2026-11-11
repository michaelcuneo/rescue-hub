import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getDeviceMapPosition } from './map-location';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { type Rescue } from './api';
import { pinForRescue, RESCUE_PIN_GROUPS, type RescuePinGroup } from './rescue-pins';
import { createRescuePinCollection } from '../../core/rescue-pin-geojson';

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
<style>html,body,#map{padding:0;margin:0;width:100%;height:100%;overflow:hidden;background:#e2ebe5}.mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right{display:none}.user-location{width:18px;height:18px;box-sizing:border-box;border-radius:50%;background:#2679eb;border:3px solid white;box-shadow:0 0 0 9px #2679eb33,0 2px 8px #0004}.mapboxgl-popup-content{font:13px system-ui;color:#173d2c;padding:11px 13px;border-radius:10px}</style>
</head><body><div id="map"></div>
<script src="https://api.mapbox.com/mapbox-gl-js/v3.16.0/mapbox-gl.js"></script>
<script>
(function(){
const send = (message) => window.ReactNativeWebView?.postMessage(JSON.stringify(message));
if (!window.mapboxgl) { send({type:'error', message:'Mapbox could not load.'}); return; }
mapboxgl.accessToken = ${token};
const map = new mapboxgl.Map({container:'map',style:${style},center:[151.7,-32.93],zoom:9,attributionControl:false});
map.addControl(new mapboxgl.NavigationControl({showCompass:false}), 'top-right');
map.addControl(new mapboxgl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true, timeout: 15000 },
  trackUserLocation: false,
  showUserLocation: false,
  showAccuracyCircle: false
}), 'top-right');
let latestCollection = {type:'FeatureCollection',features:[]};
let lastPayload = '';
let hasFitted = false;
let selectedId = null;
let locationMarker = null;
let pinsReady = false;
window.showUserLocation = function(longitude, latitude) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
  if (locationMarker) locationMarker.remove();
  const dot = document.createElement('div');
  dot.className='user-location';
  dot.setAttribute('aria-label', 'Your location');
  locationMarker = new mapboxgl.Marker({element: dot}).setLngLat([longitude, latitude]).addTo(map);
  hasFitted = true;
  map.flyTo({center:[longitude,latitude],zoom:Math.max(map.getZoom(),12)});
};
/**
 * All rescue geometry lives in a Mapbox GeoJSON source. The renderer now
 * updates the marker positions with the map camera as a single operation.
 * No DOM-marker CSS transforms, interpolation or pan-dependent offsets.
 */
function installPins(){
  if(pinsReady || !map.isStyleLoaded())return;
  if(!map.getSource('rescue-pins')){
    map.addSource('rescue-pins',{type:'geojson',data:latestCollection});
  }
  map.addLayer({id:'rescue-pins-selected',type:'circle',source:'rescue-pins',
    filter:['==',['get','id'],selectedId||''],
    paint:{'circle-radius':27,'circle-color':'#ffffff',
      'circle-opacity':0.55,'circle-stroke-width':0}});
  map.addLayer({id:'rescue-pins-base',type:'circle',source:'rescue-pins',
    paint:{'circle-radius':23,'circle-color':'#ffffff',
      'circle-stroke-width':1.4,'circle-stroke-color':'#ffffff'}});
  map.addLayer({id:'rescue-pins-fill',type:'circle',source:'rescue-pins',
    paint:{'circle-radius':19,'circle-color':['get','color'],
      'circle-stroke-width':0}});
  map.addLayer({id:'rescue-pins-status',type:'circle',source:'rescue-pins',
    paint:{
      'circle-radius':6,
      'circle-color':['case',['==',['get','status'],'PENDING'],'#e9af34','#276cd0'],
      'circle-stroke-color':'#ffffff','circle-stroke-width':2,
      'circle-translate':[15,16]
    }});
  map.addLayer({id:'rescue-pins-label',type:'symbol',source:'rescue-pins',
    layout:{'text-field':['get','initials'],'text-size':11,
      'text-font':['Open Sans Bold','Arial Unicode MS Bold'],
      'text-allow-overlap':true,'text-ignore-placement':true},
    paint:{'text-color':'#ffffff','text-halo-width':0}});
  map.on('click','rescue-pins-base',event=>{
    const feature=event.features&&event.features[0];
    if(!feature)return;
    const id=String(feature.properties?.id??'');
    const coordinates=feature.geometry?.coordinates;
    if(!id || !coordinates || coordinates.length<2)return;
    selectedId=id;
    map.setFilter('rescue-pins-selected',['==',['get','id'],selectedId]);
    map.flyTo({center:[coordinates[0],coordinates[1]],zoom:Math.max(map.getZoom(),12)});
    send({type:'select',id});
  });
  map.on('mouseenter','rescue-pins-base',()=>map.getCanvas().style.cursor='pointer');
  map.on('mouseleave','rescue-pins-base',()=>map.getCanvas().style.cursor='');
  pinsReady=true;
}
function display(collection){
  if(!collection || collection.type!=='FeatureCollection' || !Array.isArray(collection.features))return;
  const nextPayload=JSON.stringify(collection);
  latestCollection=collection;
  // The first feed may arrive before the map style has loaded.
  // Keep its data, but apply it as soon as geographic layers exist.
  if(!pinsReady || nextPayload===lastPayload)return;
  lastPayload=nextPayload;
  const source=map.getSource('rescue-pins');
  if(source)source.setData(collection);
  if(collection.features.length && !hasFitted){
    const bounds=new mapboxgl.LngLatBounds();
    for(const feature of collection.features)bounds.extend(feature.geometry.coordinates);
    map.fitBounds(bounds,{padding:55,maxZoom:12,duration:450});
    hasFitted=true;
  }
}
window.receiveRescues=display;
function installAreas(){
  fetch(${areas}).then(r => r.ok ? r.json() : Promise.reject(new Error('Boundaries unavailable'))).then(geo=>{
    if(map.getSource('operating-areas'))return;
    map.addSource('operating-areas',{type:'geojson',data:geo});
    map.addLayer({id:'operating-area-fill',type:'fill',source:'operating-areas',paint:{
      'fill-color':['case',['==',['get','organisationId'],'native-animal-trust-fund'],'#f2b705','#50a971'],
      'fill-opacity':['case',['==',['get','organisationId'],'native-animal-trust-fund'],0.16,0.035]}},map.getStyle().layers.find(x=>x.type==='symbol')?.id);
    map.addLayer({id:'operating-area-outline',type:'line',source:'operating-areas',paint:{
      'line-color':['case',['==',['get','organisationId'],'native-animal-trust-fund'],'#8a6200','#2d7148'],
      'line-width':['case',['==',['get','organisationId'],'native-animal-trust-fund'],2,0.8]}},
      map.getLayer('rescue-pins-selected')?'rescue-pins-selected':undefined);
  }).catch(()=>{/* Basemap and rescue pins remain available when GIS is down. */});
}
map.on('load',()=>{installAreas();installPins();display(latestCollection);send({type:'ready'});});
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
  const payload = useMemo(() => JSON.stringify(createRescuePinCollection(rescues.map(r => ({
    id:r.id, type:r.type, status:r.status, latitude:r.latitude, longitude:r.longitude,
    ...pinForRescue(r)
  })))), [rescues]);

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
    <WebView<{}> ref={map} source={source} geolocationEnabled
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
