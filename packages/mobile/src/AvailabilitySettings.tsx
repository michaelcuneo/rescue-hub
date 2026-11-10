import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardAwareTextInput } from './KeyboardAware';
import { getAvailability, getPushDeviceStatus, saveAvailability, type AvailabilityPolicy, type Weekday, type AvailabilityMode } from './api';
import type { PushRegistration } from './notifications';

const DAYS: Weekday[] = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function AvailabilitySettings({ onBack, onSave, onSignOut, pushStatus, onRetryPush }: {
  onBack: () => void;
  onSave: (policy: AvailabilityPolicy, status: 'AVAILABLE' | 'OFFLINE' | 'BUSY') => void;
  onSignOut: () => void | Promise<void>;
  pushStatus: PushRegistration | null;
  onRetryPush: () => Promise<PushRegistration>;
}) {
  const [policy,setPolicy] = useState<AvailabilityPolicy | null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [registeredDevices,setRegisteredDevices] = useState<number | null>(null);
  const [pushChecking,setPushChecking] = useState(false);
  useEffect(() => {
    getPushDeviceStatus().then(result => setRegisteredDevices(result.registeredDevices))
      .catch(() => setRegisteredDevices(null));
  }, [pushStatus?.status]);
  useEffect(()=>{
    getAvailability().then(r=>setPolicy(r.policy)).catch(e=>setError(e instanceof Error?e.message:'Could not load settings.'));
  },[]);
  // A manual override should take effect immediately; schedule edits remain saved explicitly.
  async function changeMode(mode: AvailabilityMode) {
    if (!policy || busy || mode === policy.mode) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveAvailability({ ...policy, mode });
      setPolicy(saved.policy);
      onSave(saved.policy, saved.status);
      setMessage(mode === 'SCHEDULE' ? 'Following your weekly schedule.' :
        saved.status === 'AVAILABLE' ? 'You are available now.' : 'You are unavailable now.');
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Unable to change availability.');
    } finally {
      setBusy(false);
    }
  }

  function updateDay(day: Weekday, change: Partial<AvailabilityPolicy['week'][Weekday]>) {
    setPolicy(p => p ? {...p,week:{...p.week,[day]:{...p.week[day],...change}}}:null);
    setMessage('');
  }
  function updateWindow(day: Weekday,index: number,field:'start'|'end',value:string){
    if(!policy)return;
    const windows=policy.week[day].windows.map((w,i)=>i===index?{...w,[field]:value}:w);
    updateDay(day,{windows});
  }
  async function save(){
    if(!policy)return;
    setError('');setMessage('');
    for(const day of DAYS){
      for(const w of policy.week[day].windows){
        if(!VALID_TIME.test(w.start) || !(VALID_TIME.test(w.end)||w.end==='24:00')){
          setError('Times must use 24-hour HH:mm format, e.g. 08:30.');return;
        }
      }
    }
    setBusy(true);
    try{
      const r=await saveAvailability(policy);
      setPolicy(r.policy);setMessage('Saved. Your availability now follows these settings.');
      onSave(r.policy,r.status);
    }catch(e){setError(e instanceof Error?e.message:'Could not save availability.');}
    finally{setBusy(false);}
  }
  const header = <View style={styles.heading}>
    <View style={styles.navigation}>
      <Pressable onPress={onBack} accessibilityRole="button"><Text style={styles.link}>‹ Map</Text></Pressable>
      <Pressable onPress={() => void onSignOut()} accessibilityRole="button" accessibilityLabel="Sign out of Rescue Hub">
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
    <Text style={styles.title}>Availability settings</Text>
    <Text style={styles.subtitle}>Set your weekly rescue hours, or temporarily override them.</Text>
  </View>;
  if(!policy) return <View style={styles.root}>{header}<View style={styles.center}>{error?<Text style={styles.error}>{error}</Text>:<ActivityIndicator />}</View></View>;
  return <KeyboardAwareScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    {header}
    <View style={styles.pushStatus}>
      <Text style={styles.overrideTitle}>Push notification readiness</Text>
      <Text style={styles.helpOverride}>{pushStatus?.message ?? 'Not checked yet.'}</Text>
      {registeredDevices !== null ?
        <Text style={styles.helpOverride}>{registeredDevices} registered device(s) on this account.</Text> : null}
      <Pressable accessibilityRole="button" disabled={pushChecking} style={styles.pushRetry}
        onPress={async () => {
          setPushChecking(true);
          try {
            await onRetryPush();
            const result = await getPushDeviceStatus();
            setRegisteredDevices(result.registeredDevices);
          } catch(e) {
            setError(e instanceof Error ? e.message : 'Could not verify push registration.');
          } finally { setPushChecking(false); }
        }}>
        <Text style={styles.link}>{pushChecking ? 'Checking…' : 'Check push registration'}</Text>
      </Pressable>
    </View>
    <Text style={styles.label}>AVAILABILITY MODE</Text>
    <View style={styles.modes}>
      <Pressable accessibilityRole="button" disabled={busy}
        accessibilityState={{selected:policy.mode==='SCHEDULE'}}
        style={[styles.mode,policy.mode==='SCHEDULE'&&styles.modeActive]}
        onPress={()=>void changeMode('SCHEDULE')}>
        <Text style={[styles.modeText,policy.mode==='SCHEDULE'&&styles.modeTextActive]}>Follow schedule</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy}
        accessibilityState={{selected:policy.mode!=='SCHEDULE'}}
        style={[styles.mode,policy.mode!=='SCHEDULE'&&styles.modeActive]}
        onPress={()=>void changeMode(policy.mode==='SCHEDULE' ? 'ON' : policy.mode)}>
        <Text style={[styles.modeText,policy.mode!=='SCHEDULE'&&styles.modeTextActive]}>Override</Text>
      </Pressable>
    </View>
    {policy.mode!=='SCHEDULE' ? <View style={styles.override}>
      <View style={styles.overrideDescription}>
        <Text style={styles.overrideTitle}>{policy.mode==='ON' ? 'Available for rescues' : 'Unavailable for rescues'}</Text>
        <Text style={styles.helpOverride}>Manually control rescue notifications until you return to your schedule.</Text>
      </View>
      <Switch value={policy.mode==='ON'} disabled={busy}
        accessibilityLabel="Override availability on or off"
        onValueChange={enabled=>void changeMode(enabled?'ON':'OFF')}/>
    </View> : null}
    <Text style={styles.label}>TIME ZONE</Text>
    <KeyboardAwareTextInput autoCapitalize="none" autoCorrect={false} style={styles.field} value={policy.timezone}
      onChangeText={timezone=>setPolicy(p=>p?{...p,timezone}:p)}
      accessibilityLabel="IANA time zone" placeholder="Australia/Sydney"/>
    <Text style={styles.help}>Examples: Australia/Sydney, Australia/Brisbane, Australia/Perth.</Text>
    <Text style={styles.label}>WEEKLY SCHEDULE</Text>
    {DAYS.map((day,index)=>{
      const entry=policy.week[day];
      return <View style={styles.day} key={day}>
        <View style={styles.dayHeader}><Text style={styles.dayTitle}>{NAMES[index]}</Text>
          <Switch value={entry.enabled} onValueChange={enabled=>updateDay(day,{enabled})}
            accessibilityLabel={`Enable ${NAMES[index]}`}/></View>
        {entry.enabled && <View style={styles.windows}>
          {entry.windows.map((w,i)=><View key={i} style={styles.window}>
            <KeyboardAwareTextInput style={styles.time} value={w.start} onChangeText={v=>updateWindow(day,i,'start',v)}
              autoCapitalize="none" keyboardType="numbers-and-punctuation" placeholder="09:00"
              accessibilityLabel={`${NAMES[index]} window ${i+1} start`}/>
            <Text style={styles.to}>to</Text>
            <KeyboardAwareTextInput style={styles.time} value={w.end} onChangeText={v=>updateWindow(day,i,'end',v)}
              keyboardType="numbers-and-punctuation" placeholder="17:00"
              accessibilityLabel={`${NAMES[index]} window ${i+1} end`}/>
            <Pressable style={styles.remove} onPress={()=>updateDay(day,{windows:entry.windows.filter((_,j)=>j!==i)})}
              accessibilityRole="button" accessibilityLabel="Remove time window"><Text style={styles.removeText}>×</Text></Pressable>
          </View>)}
          <Pressable style={styles.add} onPress={()=>updateDay(day,{windows:[...entry.windows,{start:'09:00',end:'17:00'}]})}
            disabled={entry.windows.length>=8} accessibilityRole="button">
            <Text style={styles.link}>+ Add time window</Text>
          </Pressable>
        </View>}
      </View>;
    })}
    <Text style={styles.help}>Time windows may cross midnight. A scheduled day can have up to eight non-overlapping windows. No GPS tracking is required.</Text>
    {error?<Text style={styles.error}>{error}</Text>:null}
    {message?<Text style={styles.success}>{message}</Text>:null}
    <Pressable style={styles.save} disabled={busy} onPress={save} accessibilityRole="button">
      <Text style={styles.saveText}>{busy?'Saving…':'Save availability settings'}</Text>
    </Pressable>
  </KeyboardAwareScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#edf1ee'},content:{paddingBottom:36},
 center:{flex:1,alignItems:'center',justifyContent:'center',padding:24},
 heading:{padding:20,gap:8},navigation:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},link:{color:'#24583f',fontSize:14,fontWeight:'800'},signOutText:{color:'#6c7972',fontSize:12,fontWeight:'700'},
 title:{fontSize:27,fontWeight:'800',color:'#17211d'},subtitle:{color:'#58695f',lineHeight:20},
 label:{marginHorizontal:18,marginTop:18,marginBottom:8,color:'#536b5d',fontWeight:'800',fontSize:11,letterSpacing:1.2},
 modes:{marginHorizontal:16,flexDirection:'row',gap:8},mode:{flex:1,paddingVertical:15,paddingHorizontal:6,backgroundColor:'#fff',borderRadius:11,alignItems:'center',borderWidth:1,borderColor:'#d9e1dc'},
 override:{marginHorizontal:16,marginTop:10,padding:15,backgroundColor:'#fff',borderWidth:1,borderColor:'#d9e1dc',borderRadius:13,flexDirection:'row',alignItems:'center',gap:12},
 overrideDescription:{flex:1},overrideTitle:{color:'#173d2c',fontWeight:'800',fontSize:15},helpOverride:{fontSize:12,color:'#6c7972',lineHeight:18,marginTop:4},
 pushStatus:{marginHorizontal:16,padding:15,backgroundColor:'#fff',borderWidth:1,borderColor:'#d9e1dc',borderRadius:13,gap:5},
 pushRetry:{alignSelf:'flex-start',paddingVertical:10,paddingRight:10},
 modeActive:{backgroundColor:'#173d2c',borderColor:'#173d2c'},modeText:{color:'#40594c',fontWeight:'800',fontSize:12},modeTextActive:{color:'#fff'},
 field:{marginHorizontal:16,backgroundColor:'#fff',borderWidth:1,borderColor:'#d9e1dc',borderRadius:10,padding:12,fontSize:15,color:'#17211d'},
 help:{marginHorizontal:18,marginTop:6,fontSize:12,color:'#6c7972',lineHeight:18},
 day:{marginHorizontal:16,marginBottom:9,padding:14,borderWidth:1,borderColor:'#d9e1dc',borderRadius:14,backgroundColor:'#fff'},
 dayHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 dayTitle:{fontSize:16,fontWeight:'800',color:'#17211d'},
 windows:{gap:9,marginTop:10},window:{flexDirection:'row',gap:7,alignItems:'center'},
 time:{width:85,borderWidth:1,borderColor:'#d9e1dc',borderRadius:8,padding:10,color:'#17211d',fontSize:14},
 to:{color:'#6c7972'},remove:{marginLeft:'auto',paddingHorizontal:10},removeText:{fontSize:26,color:'#a23f35'},
 add:{paddingTop:8,paddingBottom:4},
 error:{margin:18,color:'#a23f35',fontWeight:'600'},success:{margin:18,color:'#246642',fontWeight:'700'},
 save:{margin:16,padding:17,backgroundColor:'#173d2c',borderRadius:13,alignItems:'center'},
 saveText:{color:'#fff',fontSize:15,fontWeight:'800'}
});
