import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  getRescues,
  getAvailability,
  saveAvailability,
  claimRescue,
  login,
  logout,
  restoreSession,
  setAvailability,
  type AvailabilityPolicy,
  type AvailabilityMode,
  type MembershipConfig,
  type Rescue,
  type User
} from './src/api';
import { registerForPushNotifications } from './src/notifications';
import AnimalCare from './src/AnimalCare';
import AvailabilitySettings from './src/AvailabilitySettings';
import RescueMap from './src/RescueMap';

type Session = { user: User; membership: MembershipConfig };

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [rescues, setRescues] = useState<Rescue[]>([]);
  const [activeRescue, setActiveRescue] = useState<Rescue | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'map' | 'list' | 'settings'>('map');
  const [policy, setPolicy] = useState<AvailabilityPolicy | null>(null);

  useEffect(() => {
    void (async () => {
      const restored = await restoreSession();
      if (restored) {
        setSession(restored);
        await registerForPushNotifications().catch(console.warn);
        const result = await getRescues().catch(() => ({ items: [] }));
        setRescues(result.items);
        await getAvailability().then(({ policy }) => setPolicy(policy)).catch(console.warn);
      }
      setLoading(false);
    })();
  }, []);

  const teamNames = useMemo(() => {
    if (!session) return [];
    const ids = new Set(session.user.teamIds);
    return session.membership.teams.filter((team) => ids.has(team.id)).map((team) => team.name);
  }, [session]);

  async function handleLogin() {
    setBusy(true);
    setError('');
    try {
      const result = await login(email.trim(), password);
      setSession({ user: result.user, membership: result.membership });
      await registerForPushNotifications().catch(console.warn);
      setRescues((await getRescues()).items);
      await getAvailability().then(({ policy }) => setPolicy(policy)).catch(console.warn);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function handleClaim(id: string) {
    setBusy(true);
    setError('');
    try {
      await claimRescue(id);
      setRescues((await getRescues()).items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to claim rescue.');
      await getRescues().then((result) => setRescues(result.items)).catch(console.warn);
    } finally {
      setBusy(false);
    }
  }

  async function selectMode(mode: AvailabilityMode) {
    if (!session || busy) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'SCHEDULE') {
        const current = policy ?? (await getAvailability()).policy;
        const result = await saveAvailability({ ...current, mode });
        setPolicy(result.policy);
        setSession({ ...session, user: { ...session.user, availabilityStatus: result.status, availabilityPolicy: result.policy } });
      } else {
        const result = await setAvailability(mode === 'ON' ? 'AVAILABLE' : 'OFFLINE');
        setSession({ ...session, user: { ...session.user, availabilityStatus: result.status } });
        setPolicy(result.policy);
      }
      setRescues((await getRescues()).items);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to change availability.'); }
    finally { setBusy(false); }
  }

  async function refresh() {
    setError('');
    try {
      const [rescuesResult, availabilityResult] = await Promise.all([getRescues(), getAvailability()]);
      setRescues(rescuesResult.items);
      setPolicy(availabilityResult.policy);
      if (session) setSession({ ...session, user: { ...session.user, availabilityStatus: availabilityResult.status } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not refresh rescues.'); }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator /></View>;

  if (!session) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.login}>
          <Text style={styles.kicker}>RESCUE HUB</Text>
          <Text style={styles.title}>Rescuer sign in</Text>
          <Text style={styles.copy}>Receive rescue notifications for the teams you are qualified to support.</Text>
          <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} />
          <TextInput secureTextEntry placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={busy}>
            <Text style={styles.primaryButtonText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const available = session.user.availabilityStatus === 'AVAILABLE';
  const currentMode: AvailabilityMode = policy?.mode ?? (available ? 'ON' : 'OFF');

  if (view === 'settings') return <SafeAreaView style={styles.root}><AvailabilitySettings
    onBack={() => { setView('map'); void refresh(); }}
    onSave={(savedPolicy, status) => {
      setPolicy(savedPolicy);
      setSession({ ...session, user: { ...session.user, availabilityStatus: status, availabilityPolicy: savedPolicy } });
    }}
  /></SafeAreaView>;

  if (activeRescue) return <SafeAreaView style={styles.root}><AnimalCare rescue={activeRescue} userId={session.user.id} onBack={() => setActiveRescue(null)} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>RESCUE HUB · NATF</Text>
          <Text style={styles.title}>{session.user.name}</Text>
          <Text style={styles.copy}>{teamNames.join(' · ') || 'No rescue teams assigned'}</Text>
        </View>
        <Pressable style={styles.settingsButton} onPress={() => setView('settings')} accessibilityRole="button"
          accessibilityLabel="Open availability settings"><Text style={styles.settingsText}>Settings ⚙</Text></Pressable>
      </View>

      <View style={styles.availability}>
        <Text style={styles.availabilityTitle}>{available ? 'Receiving rescues' : 'Not receiving rescues'}</Text>
        <Text style={styles.copy}>
          {currentMode === 'SCHEDULE' ? 'Weekly schedule active. Switch ON or OFF to override.'
            : currentMode === 'ON' ? 'Manual override: available now.' : 'Manual override: unavailable now.'}
        </Text>
        <View style={styles.modeRow}>
          {(['ON','OFF','SCHEDULE'] as AvailabilityMode[]).map(mode => (
            <Pressable key={mode} disabled={busy} onPress={() => selectMode(mode)}
              accessibilityRole="button" accessibilityState={{selected:currentMode === mode}}
              style={[styles.modeButton,currentMode === mode && styles.modeSelected]}>
              <Text style={[styles.modeText,currentMode === mode && styles.modeTextSelected]}>
                {mode === 'SCHEDULE' ? 'Follow schedule' : mode}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Rescues</Text>
        <Pressable onPress={refresh} accessibilityRole="button"><Text style={styles.refresh}>Refresh</Text></Pressable>
      </View>
      <View style={styles.modeRowWide}>
        <Pressable style={[styles.viewButton,view==='map'&&styles.viewSelected]} onPress={()=>setView('map')} accessibilityRole="button">
          <Text style={[styles.viewText,view==='map'&&styles.viewTextSelected]}>Map</Text>
        </Pressable>
        <Pressable style={[styles.viewButton,view==='list'&&styles.viewSelected]} onPress={()=>setView('list')} accessibilityRole="button">
          <Text style={[styles.viewText,view==='list'&&styles.viewTextSelected]}>List</Text>
        </Pressable>
      </View>

      {view === 'map' ? <RescueMap rescues={rescues} onSelect={(item) => {
        if (item.assignedUserId === session.user.id) setActiveRescue(item);
        else setView('list');
      }} /> : null}

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      <FlatList
        data={rescues}
        style={styles.rescueList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={view==='map' ? <Text style={styles.listNote}>Rescue details · tap a pin to locate a rescue</Text> : null}
        ListEmptyComponent={<Text style={styles.empty}>No matching rescues are waiting right now.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.animal}>{item.type}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
            <Text style={styles.location}>{item.location || 'Location not recorded'}</Text>
            <Text style={styles.injury}>{item.injury || 'Condition not recorded'}</Text>
            {item.status === 'PENDING' ? (
              <Pressable style={styles.claimButton} disabled={busy || !available} onPress={() => handleClaim(item.id)}>
                <Text style={styles.primaryButtonText}>{busy ? 'Please wait…' : 'Claim rescue'}</Text>
              </Pressable>
            ) : item.assignedUserId === session.user.id ? (
              <>
                <Text style={styles.mine}>Claimed by you · response in progress</Text>
                <Pressable style={styles.claimButton} onPress={() => setActiveRescue(item)}>
                  <Text style={styles.primaryButtonText}>Manage animals and care history</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        )}
      />

      <Pressable
        style={styles.signOut}
        onPress={async () => {
          await logout();
          setSession(null);
          setRescues([]);
          setActiveRescue(null);
          setPolicy(null);
          setView('map');
        }}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#edf1ee' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  login: { flex: 1, justifyContent: 'center', padding: 28, gap: 12 },
  kicker: { color: '#648074', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#17211d', fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  copy: { color: '#66736c', fontSize: 13, lineHeight: 19 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e1dc', borderRadius: 12, padding: 14 },
  error: { color: '#a23f35', fontSize: 12 },
  primaryButton: { backgroundColor: '#173d2c', borderRadius: 12, padding: 15, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', gap: 18, alignItems: 'center' },
  headerCopy: { flex: 1 },
  availability: { marginHorizontal: 16, padding: 16, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#d9e1dc' },
  availabilityTitle: { color: '#173d2c', fontWeight: '800', marginBottom: 4 },
  sectionHeader: { marginTop: 22, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: '#17211d', fontWeight: '800', fontSize: 16 },
  refresh: { color: '#24583f', fontWeight: '700' },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 15, borderWidth: 1, borderColor: '#d9e1dc' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  animal: { color: '#17211d', fontWeight: '800', fontSize: 16 },
  status: { color: '#7b5b0d', backgroundColor: '#fff1cd', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '800' },
  location: { marginTop: 7, color: '#435249', fontWeight: '700' },
  injury: { marginTop: 4, color: '#76837b', lineHeight: 18 },
  empty: { textAlign: 'center', color: '#76837b', paddingVertical: 40 },
  claimButton: { backgroundColor: '#173d2c', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  mine: { color: '#24583f', fontWeight: '700', marginTop: 12 },
  errorBanner: { color: '#a23f35', paddingHorizontal: 20, paddingTop: 10 },
  signOut: { margin: 16, padding: 12, alignItems: 'center' },
  signOutText: { color: '#6c7972', fontWeight: '700' },
  settingsButton:{padding:10,backgroundColor:'#fff',borderRadius:10},
  settingsText:{fontSize:13,color:'#173d2c',fontWeight:'800'},
  modeRow:{flexDirection:'row',gap:8,marginTop:14},
  modeButton:{flex:1,backgroundColor:'#f2f5f2',borderRadius:10,alignItems:'center',justifyContent:'center',paddingVertical:13,paddingHorizontal:5,borderWidth:1,borderColor:'#dde5df'},
  modeSelected:{backgroundColor:'#173d2c',borderColor:'#173d2c'},
  modeText:{fontWeight:'800',fontSize:12,color:'#345442'},modeTextSelected:{color:'#fff'},
  modeRowWide:{flexDirection:'row',marginHorizontal:16,marginTop:10,gap:8},
  viewButton:{flex:1,alignItems:'center',padding:9,backgroundColor:'#fff',borderRadius:9},
  viewSelected:{backgroundColor:'#173d2c'},viewText:{fontWeight:'700',color:'#173d2c'},viewTextSelected:{color:'#fff'},
  rescueList:{flex:1},listNote:{fontSize:12,color:'#58695f',paddingBottom:5}
});
