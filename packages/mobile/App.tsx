import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  getRescues,
  getAvailability,
  claimRescue,
  login,
  logout,
  restoreSession,
  type AvailabilityPolicy,
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
  const [selectedMapRescue, setSelectedMapRescue] = useState<Rescue | null>(null);
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

  // Poll the authenticated GraphQL-backed rescue feed while the app is foregrounded.
  // Do not wait for a user to tap Refresh; avoid overlapping requests on slow networks.
  useEffect(() => {
    if (!session?.user.id) return;
    const userId = session.user.id;
    let closed = false;
    let inFlight = false;
    let foreground = AppState.currentState === 'active';

    const sync = async () => {
      if (closed || !foreground || inFlight) return;
      inFlight = true;
      try {
        const [rescueResult, availabilityResult] = await Promise.all([
          getRescues(), getAvailability()
        ]);
        if (closed) return;
        setRescues(rescueResult.items);
        setSelectedMapRescue(current =>
          current ? rescueResult.items.find(rescue => rescue.id === current.id) ?? null : null);
        setPolicy(availabilityResult.policy);
        setSession(current => current?.user.id === userId
          ? { ...current, user: { ...current.user, availabilityStatus: availabilityResult.status,
              availabilityPolicy: availabilityResult.policy } }
          : current);
        setError('');
      } catch (e) {
        if (!closed) setError(e instanceof Error ? e.message : 'Live rescue updates unavailable.');
      } finally {
        inFlight = false;
      }
    };

    void sync();
    const interval = setInterval(() => { void sync(); }, 10000);
    const subscription = AppState.addEventListener('change', state => {
      foreground = state === 'active';
      if (foreground) void sync();
    });
    return () => {
      closed = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [session?.user.id]);

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
      const result = await getRescues();
      setRescues(result.items);
      setSelectedMapRescue(result.items.find((item) => item.id === id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to claim rescue.');
      await getRescues().then((result) => setRescues(result.items)).catch(console.warn);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await logout();
    setSession(null);
    setRescues([]);
    setActiveRescue(null);
    setSelectedMapRescue(null);
    setPolicy(null);
    setView('map');
  }

  async function refresh() {
    setError('');
    try {
      const [rescuesResult, availabilityResult] = await Promise.all([getRescues(), getAvailability()]);
      setRescues(rescuesResult.items);
      setSelectedMapRescue((current) => current ? rescuesResult.items.find((item) => item.id === current.id) ?? null : null);
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

  if (view === 'settings') return <SafeAreaView style={styles.root}><AvailabilitySettings
    onBack={() => { setView('map'); void refresh(); }}
    onSignOut={signOut}
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
          <Text style={styles.kicker}>RESCUE HUB</Text>
          <Text style={styles.context} numberOfLines={1}>{teamNames.join(' · ') || session.user.name}</Text>
        </View>
        <Pressable style={styles.headerAction} onPress={() => setView('settings')} accessibilityRole="button"
          accessibilityLabel="Open settings"><Text style={styles.headerActionText}>Settings</Text></Pressable>
      </View>

      <View style={styles.viewBar}>
        <Pressable style={[styles.viewButton,view==='map' && styles.viewSelected]} onPress={() => setView('map')} accessibilityRole="button"
          accessibilityState={{selected:view==='map'}}>
          <Text style={[styles.viewText,view==='map' && styles.viewTextSelected]}>Map</Text>
        </Pressable>
        <Pressable style={[styles.viewButton,view==='list' && styles.viewSelected]} onPress={() => setView('list')} accessibilityRole="button"
          accessibilityState={{selected:view==='list'}}>
          <Text style={[styles.viewText,view==='list' && styles.viewTextSelected]}>List ({rescues.length})</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {view === 'map' ? (
        <View style={styles.mapBody}>
          <RescueMap rescues={rescues} onSelect={setSelectedMapRescue} />
          {selectedMapRescue ? (
            <View style={styles.selectedRescue}>
              <View style={styles.selectedHeading}>
                <Text style={styles.animal} numberOfLines={1}>{selectedMapRescue.type}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close rescue details"
                  onPress={() => setSelectedMapRescue(null)} style={styles.dismiss}>
                  <Text style={styles.dismissText}>×</Text>
                </Pressable>
              </View>
              <Text style={styles.location}>{selectedMapRescue.location || 'Location not recorded'}</Text>
              <Text style={styles.injury} numberOfLines={2}>{selectedMapRescue.injury || 'Condition not recorded'}</Text>
              {selectedMapRescue.status === 'PENDING' ? available ? (
                <Pressable style={styles.claimButton} disabled={busy} onPress={() => handleClaim(selectedMapRescue.id)}
                  accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>{busy ? 'Please wait…' : 'Claim rescue'}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.claimButton} onPress={() => setView('settings')} accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>Change availability in Settings to claim</Text>
                </Pressable>
              ) : selectedMapRescue.assignedUserId === session.user.id ? (
                <Pressable style={styles.claimButton} onPress={() => setActiveRescue(selectedMapRescue)}
                  accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>Manage animal care</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={rescues}
          style={styles.rescueList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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
                  <Text style={styles.primaryButtonText}>{busy ? 'Please wait…' : available ? 'Claim rescue' : 'Available in Settings to claim'}</Text>
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
      )}

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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  headerCopy: { flex: 1, minWidth: 0 },
  context: { color: '#4b6555', fontSize: 12, marginTop: 3, fontWeight: '600' },
  headerAction: { paddingHorizontal: 10, paddingVertical: 11, backgroundColor: '#fff', borderRadius: 10 },
  headerActionText: { color: '#173d2c', fontSize: 13, fontWeight: '800' },
  viewBar: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 8 },
  viewButton: { flex: 1, alignItems: 'center', borderRadius: 9, backgroundColor: '#fff', paddingVertical: 9 },
  viewSelected: { backgroundColor: '#173d2c' },
  viewText: { color: '#173d2c', fontSize: 13, fontWeight: '800' },
  viewTextSelected: { color: '#fff' },
  mapBody: { flex: 1, position: 'relative' },
  selectedRescue: { position: 'absolute', bottom: 14, left: 14, right: 14, borderRadius: 16,
    padding: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e1dc',
    shadowColor: '#000', shadowOpacity: 0.13, shadowRadius: 14, elevation: 5 },
  selectedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dismiss: { paddingHorizontal: 8, paddingVertical: 2 },
  dismissText: { color: '#4b6555', fontSize: 25, lineHeight: 28 },
  list: { padding: 14, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 15, borderWidth: 1, borderColor: '#d9e1dc' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  animal: { color: '#17211d', fontWeight: '800', fontSize: 16, flexShrink: 1 },
  status: { color: '#7b5b0d', backgroundColor: '#fff1cd', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '800' },
  location: { marginTop: 7, color: '#435249', fontWeight: '700' },
  injury: { marginTop: 4, color: '#76837b', lineHeight: 18 },
  empty: { textAlign: 'center', color: '#76837b', paddingVertical: 40 },
  claimButton: { backgroundColor: '#173d2c', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  mine: { color: '#24583f', fontWeight: '700', marginTop: 12 },
  errorBanner: { color: '#a23f35', paddingHorizontal: 20, paddingTop: 10 },
  rescueList: { flex: 1 }
});
