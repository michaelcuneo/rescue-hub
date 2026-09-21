import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
  login,
  logout,
  restoreSession,
  setAvailability,
  type MembershipConfig,
  type Rescue,
  type User
} from './src/api';
import { registerForPushNotifications } from './src/notifications';

type Session = { user: User; membership: MembershipConfig };

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [rescues, setRescues] = useState<Rescue[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const restored = await restoreSession();
      if (restored) {
        setSession(restored);
        await registerForPushNotifications().catch(console.warn);
        const result = await getRescues().catch(() => ({ items: [] }));
        setRescues(result.items);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailable(value: boolean) {
    if (!session) return;
    const status = value ? 'AVAILABLE' : 'OFFLINE';
    await setAvailability(status);
    setSession({ ...session, user: { ...session.user, availabilityStatus: status } });
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

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>RESCUE HUB</Text>
          <Text style={styles.title}>{session.user.name}</Text>
          <Text style={styles.copy}>{teamNames.join(' · ') || 'No dispatch teams assigned'}</Text>
        </View>
        <Switch value={available} onValueChange={toggleAvailable} />
      </View>

      <View style={styles.availability}>
        <Text style={styles.availabilityTitle}>{available ? 'Available for rescue' : 'Not receiving rescues'}</Text>
        <Text style={styles.copy}>
          {available
            ? 'You will be notified when a rescue matches one of your teams.'
            : 'Turn availability on when you are ready to receive dispatches.'}
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Available rescues</Text>
        <Pressable onPress={async () => setRescues((await getRescues()).items)}>
          <Text style={styles.refresh}>Refresh</Text>
        </Pressable>
      </View>

      <FlatList
        data={rescues}
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
          </View>
        )}
      />

      <Pressable
        style={styles.signOut}
        onPress={async () => {
          await logout();
          setSession(null);
          setRescues([]);
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
  signOut: { margin: 16, padding: 12, alignItems: 'center' },
  signOutText: { color: '#6c7972', fontWeight: '700' }
});
