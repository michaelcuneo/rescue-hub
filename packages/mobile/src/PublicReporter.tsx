import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { getDeviceMapPosition } from './map-location';
import { myPublicReports, submitPublicReport, type PublicWildlifeReport } from './api';
import ReporterConversation from './ReporterConversation';

type Pin = { latitude: number; longitude: number };
type Props = { onSignOut: () => void | Promise<void> };
const token = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '').trim();

function mapHTML() {
  const publicToken = JSON.stringify(token);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="https://api.mapbox.com/mapbox-gl-js/v3.16.0/mapbox-gl.css" rel="stylesheet">
<style>html,body,#map{margin:0;width:100%;height:100%;overflow:hidden;background:#dfeae2}.mapboxgl-ctrl-bottom-right{display:none}.pin{width:22px;height:22px;background:#b84629;border:4px solid white;border-radius:100%;box-sizing:border-box;box-shadow:0 0 0 6px #b8462944}.user-location{width:18px;height:18px;border-radius:50%;background:#2679eb;border:3px solid white;box-shadow:0 0 0 9px #2679eb33}</style>
</head><body><div id="map"></div><script src="https://api.mapbox.com/mapbox-gl-js/v3.16.0/mapbox-gl.js"></script><script>
(function(){
if(!window.mapboxgl){window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'Mapbox is unavailable.'}));return;}
mapboxgl.accessToken=${publicToken};
var map=new mapboxgl.Map({container:'map',style:'mapbox://styles/michaelcuneo/ckzzecgy7005j14qvpzd53fgn',center:[151.70,-32.93],zoom:10,attributionControl:false});
map.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');
map.addControl(new mapboxgl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true, timeout: 15000 },
  trackUserLocation: false,
  showUserLocation: false,
  showAccuracyCircle: false
}), 'top-right');
var marker=null;
function place(lon,lat){
 if(!Number.isFinite(lon)||!Number.isFinite(lat))return;
 if(marker)marker.remove();
 var element=document.createElement('div');element.className='pin';
 marker=new mapboxgl.Marker({element}).setLngLat([lon,lat]).addTo(map);
 window.ReactNativeWebView.postMessage(JSON.stringify({type:'pin',latitude:lat,longitude:lon}));
}
map.on('click',function(e){place(e.lngLat.lng,e.lngLat.lat)});
var userLocationMarker=null;
// The animal may not be at the reporter's current GPS location: centre the
// map and display the blue location dot, but do not silently submit a pin.
window.showUserLocation=function(lon,lat){
 if(!Number.isFinite(lon)||!Number.isFinite(lat))return;
 if(userLocationMarker)userLocationMarker.remove();
 var dot=document.createElement('div');dot.className='user-location';
 dot.setAttribute('aria-label','Your current location');
 userLocationMarker=new mapboxgl.Marker({element:dot}).setLngLat([lon,lat]).addTo(map);
 map.flyTo({center:[lon,lat],zoom:15});
};
window.clearReportPin=function(){if(marker){marker.remove();marker=null;}};

map.on('load',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}))});
})();</script></body></html>`;
}

export default function PublicReporter({ onSignOut }: Props) {
  const ref = useRef<WebView<{}>>(null);
  const source = useMemo(() => ({ html: mapHTML(), baseUrl: 'https://api.mapbox.com' }), []);
  const [pin, setPin] = useState<Pin | null>(null);
  const [animal, setAnimal] = useState('');
  const [condition, setCondition] = useState('');
  const [allowMessages, setAllowMessages] = useState(false);
  const [allowPhoneContact, setAllowPhoneContact] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const locatingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [history, setHistory] = useState<PublicWildlifeReport[]>([]);
  const refreshHistory = () => { void myPublicReports().then(data => setHistory(data.items)).catch(() => {}); };
  useEffect(() => { refreshHistory(); }, []);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as
        { type: string; latitude?: number; longitude?: number; message?: string };
      if (data.type === 'ready') { setReady(true); void locate(true); }
      if (data.type === 'locate') void locate();
      if (data.type === 'error') setError(data.message ?? 'Map unavailable.');
      if (data.type === 'pin' && typeof data.latitude === 'number' &&
          typeof data.longitude === 'number') {
        setPin({ latitude: data.latitude, longitude: data.longitude });
      }
    } catch { /* Only accept known map messages. */ }
  };

  async function locate(quiet = false) {
    if (locatingRef.current) return;
    locatingRef.current = true;
    if (!quiet) setError('');
    try {
      const position = await getDeviceMapPosition();
      if (!position) {
        if (!quiet) setError('Location access is off. Tap the map to place the animal pin.');
        return;
      }
      ref.current?.injectJavaScript(`window.showUserLocation(${position.longitude},${position.latitude});true;`);
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : 'Location unavailable. Tap the map instead.');
    } finally { locatingRef.current = false; }
  }

  if (conversationId) return <ReporterConversation reportId={conversationId} onBack={() => setConversationId('')} />;

  async function submit() {
    if (!pin || sending) return;
    setSending(true);
    setError('');
    try {
      const result = await submitPublicReport(animal.trim(), condition.trim(), pin.latitude, pin.longitude,
        { allowMessages, allowPhoneContact, contactPhone: allowPhoneContact ? contactPhone : undefined });
      setReceipt(result.report.id);
      refreshHistory();
      setAnimal('');
      setCondition('');
      setPin(null);
      ref.current?.injectJavaScript('window.clearReportPin();true;');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send wildlife report.');
    } finally { setSending(false); }
  }

  return <View style={styles.root}>
    <View style={styles.header}>
      <View style={styles.headerTitle}>
        <Text style={styles.kicker}>RESCUE HUB</Text>
        <Text style={styles.heading}>Report injured wildlife</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => void onSignOut()} style={styles.signout}>
        <Text style={styles.small}>Sign out</Text>
      </Pressable>
    </View>
    <View style={styles.map}>
      {token.startsWith('pk.') ? <WebView<{}> ref={ref} source={source} geolocationEnabled onMessage={onMessage}
        originWhitelist={['https://*']} javaScriptEnabled domStorageEnabled
        onError={e => setError(e.nativeEvent.description)} /> :
        <Text style={styles.error}>Mapbox token not configured in the Expo environment.</Text>}
      {token.startsWith('pk.') && !ready && <View pointerEvents="none" style={styles.loading}><ActivityIndicator /></View>}
    </View>
    <ScrollView style={styles.form} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
      {receipt ? <View style={styles.success}>
        <Text style={styles.bold}>Report received. Thank you.</Text>
        <Text style={styles.small}>Your report has been submitted for automatic geographic routing. Reference: {receipt}</Text>
        {allowMessages ? <Pressable accessibilityRole="button" onPress={() => setConversationId(receipt)}>
          <Text style={styles.link}>Message your rescuer</Text>
        </Pressable> : null}
        <Pressable accessibilityRole="button" onPress={() => setReceipt('')}>
          <Text style={styles.link}>Report another animal</Text>
        </Pressable>
      </View> : <>
        <Text style={styles.small}>The map centres on your current location when permitted. Tap to mark where the animal actually is. Do not handle unfamiliar animals, snakes or bats.</Text>
        {pin ? <Text style={styles.pinText}>Pin: {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}</Text> :
          <Text style={styles.pinText}>No location chosen yet</Text>}
        <Text style={styles.label}>What animal do you think it is?</Text>
        <TextInput style={styles.input} value={animal} onChangeText={setAnimal} maxLength={120}
          placeholder="e.g. Blue-tongue lizard" accessibilityLabel="Animal identification" />
        <Text style={styles.label}>What looks wrong?</Text>
        <TextInput style={[styles.input,styles.notes]} value={condition} onChangeText={setCondition}
          maxLength={2000} multiline textAlignVertical="top"
          placeholder="e.g. Injured leg beside the road" accessibilityLabel="Suspected injury or animal condition" />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: allowMessages }}
          onPress={() => setAllowMessages(v => !v)}>
          <Text style={styles.label}>{allowMessages ? '☑' : '☐'} Allow the rescuer to message me in the app</Text>
        </Pressable>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: allowPhoneContact }}
          onPress={() => setAllowPhoneContact(v => !v)}>
          <Text style={styles.label}>{allowPhoneContact ? '☑' : '☐'} Allow the rescuer to phone me</Text>
        </Pressable>
        {allowPhoneContact ? <TextInput style={styles.input} keyboardType="phone-pad" value={contactPhone}
          onChangeText={setContactPhone} maxLength={20} placeholder="Your contact phone number" accessibilityLabel="Contact phone number" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" style={styles.submit}
          disabled={sending || !pin || animal.trim().length < 2 || condition.trim().length < 5}
          onPress={() => void submit()}>
          <Text style={styles.submitText}>{sending ? 'Sending…' : 'Send wildlife report'}</Text>
        </Pressable>
      </>}
      <View style={styles.reportHistory}>
        <Text style={styles.bold}>Your reports</Text>
        {history.map(report => <View style={styles.historyItem} key={report.id}>
          <Text style={styles.label}>{report.animal}</Text>
          <Text style={styles.small}>{report.status.replace(/_/g, ' ')} · {new Date(report.createdAt).toLocaleString()}</Text>
          {report.allowMessages ? <Pressable accessibilityRole="button" onPress={() => setConversationId(report.id)}><Text style={styles.link}>Open messages</Text></Pressable> : null}
        </View>)}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#edf1ee'},
  header:{flexDirection:'row',alignItems:'center',gap:10,padding:14,backgroundColor:'#fff'},
  headerTitle:{flex:1},kicker:{fontSize:11,color:'#648074',fontWeight:'900',letterSpacing:1},
  heading:{fontSize:18,fontWeight:'800',color:'#173d2c'},
  signout:{padding:8},small:{color:'#5e7063',fontSize:12,lineHeight:18},
  map:{height:'45%',minHeight:230,backgroundColor:'#dce7df',position:'relative'},
  loading:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center'},
  form:{flex:1},formContent:{padding:18,gap:10,paddingBottom:36},
  label:{fontSize:14,color:'#173d2c',fontWeight:'800',marginTop:6},
  input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#cbd9d0',borderRadius:10,minHeight:47,padding:12},
  notes:{minHeight:100},pinText:{fontSize:12,fontWeight:'800',color:'#24583f'},
  error:{fontSize:12,color:'#a23f35',padding:10},
  submit:{backgroundColor:'#173d2c',borderRadius:10,padding:14,alignItems:'center',marginTop:8},
  submitText:{color:'#fff',fontWeight:'900'},success:{backgroundColor:'#fff',padding:18,borderRadius:12,gap:9},
  bold:{fontSize:17,fontWeight:'800',color:'#173d2c'},link:{color:'#24583f',fontWeight:'800'},
  reportHistory:{marginTop:20,gap:10},historyItem:{backgroundColor:'#fff',padding:12,borderRadius:10,gap:6}
});
