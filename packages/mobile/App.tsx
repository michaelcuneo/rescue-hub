import { useEffect, useMemo, useState } from 'react';
import { KeyboardAwareScrollView, KeyboardAwareTextInput, useKeyboardVisible } from './src/KeyboardAware';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Modal,
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
  getRealtimeConfig,
  getAvailability,
  claimRescue,
  unclaimRescue,
  login,
  logout,
  restoreSession,
  signupReporter,
  verifyReporter,
  availableSocialProviders,
  loginSocialReporter,
  type SocialProvider,
  type AvailabilityPolicy,
  type MembershipConfig,
  type Rescue,
  type RescueFeedDiagnostics,
  type User
} from './src/api';
import { registerForPushNotifications, type PushRegistration } from './src/notifications';
import AnimalCare from './src/AnimalCare';
import AvailabilitySettings from './src/AvailabilitySettings';
import RescueMap from './src/RescueMap';
import RescueAddress from './src/RescueAddress';
import PublicReporter from './src/PublicReporter';
import CarerOffers from './src/CarerOffers';
import OrganisationChats from './src/OrganisationChats';
import BottomTabs from './src/BottomTabs';
import { subscribeRescueChanges } from '../core/realtime-client';
import { shouldShowRescuePin } from '../core/case-map-visibility';

type Session = { user: User; membership: MembershipConfig | null };
type ClaimNotice = { title: string; message: string };

function claimNoticeFor(error: unknown): ClaimNotice {
  const raw = error instanceof Error ? error.message : 'Unable to claim this rescue.';
  const training = raw.match(/This rescue (?:requires|needs) (.+?) training\b/i)?.[1];
  if (training) {
    return {
      title: 'Training required',
      message: `This rescue needs ${training.trim().toLowerCase()} training. Once you complete it, your organisation administrator can update your permissions.`
    };
  }
  if (/Rescuer system permission|Only approved rescuers can claim species rescues/i.test(raw)) {
    return {
      title: 'Rescuer access required',
      message: 'Ask your organisation administrator to enable rescuer access on your account.'
    };
  }
  return { title: 'Could not claim rescue', message: raw };
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const keyboardVisible = useKeyboardVisible();
  const [session, setSession] = useState<Session | null>(null);
  const [rescues, setRescues] = useState<Rescue[]>([]);
  const [activeRescue, setActiveRescue] = useState<Rescue | null>(null);
  const [selectedMapRescue, setSelectedMapRescue] = useState<Rescue | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'verify' | 'rescuer'>('signup');
  const [socialProviders, setSocialProviders] = useState<SocialProvider[]>([]);
  const [error, setError] = useState('');
  const [claimNotice, setClaimNotice] = useState<ClaimNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'map' | 'list' | 'settings' | 'care' | 'chats'>('map');
  const [policy, setPolicy] = useState<AvailabilityPolicy | null>(null);
  const [pushStatus, setPushStatus] = useState<PushRegistration | null>(null);
  const [feed, setFeed] = useState<RescueFeedDiagnostics | null>(null);

  useEffect(() => {
    void availableSocialProviders().then(result => setSocialProviders(result.providers)).catch(() => {});
  }, []);

  useEffect(() => {
    void (async () => {
      const restored = await restoreSession();
      if (restored) {
        setSession(restored);
        if (!restored.user.roles?.includes('PUBLIC_REPORTER') &&
            !restored.user.roles?.includes('VET_STAFF')) {
          if (restored.user.organisationId)
            void registerForPushNotifications().then(setPushStatus).catch(console.warn);
          try {
            const result = await getRescues();
            setRescues(result.items);
            setFeed(result.feed ?? null);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to load assigned rescues.');
          }
          if (restored.user.organisationId)
            await getAvailability().then(({ policy }) => setPolicy(policy)).catch(console.warn);
        }
      }
      setLoading(false);
    })();
  }, []);

  // AppSync subscriptions invalidate the authenticated rescue feed. The
  // server filters actual records by organisation/team/custodian; the websocket
  // carries no rescue or location data and has no mutation permissions.
  useEffect(() => {
    if (!session?.user.id || session.user.roles?.includes('PUBLIC_REPORTER') ||
        session.user.roles?.includes('VET_STAFF') ||
        (!session.user.organisationId && !session.user.roles?.some(role =>
          ['PLATFORM_ADMIN','AUTHORITY_ADMIN'].includes(role)))) return;
    const userId = session.user.id;
    let closed = false;
    let foreground = AppState.currentState === 'active';
    let connected = false;
    let subscription: (() => void) | null = null;
    let retryConfig: ReturnType<typeof setTimeout> | null = null;
    let delayedRefresh: ReturnType<typeof setTimeout> | null = null;
    let generation = 0;
    let inFlight = false;
    let pending = false;

    const sync = async () => {
      if (closed || !foreground) return;
      if (inFlight) { pending = true; return; }
      inFlight = true;
      try {
        const [rescueResult, availabilityResult] = await Promise.all([
          getRescues(), session.user.organisationId
            ? getAvailability().catch(() => null) : Promise.resolve(null)
        ]);
        if (closed || !foreground) return;
        setRescues(rescueResult.items);
        setFeed(rescueResult.feed ?? null);
        setSelectedMapRescue(current =>
          current ? rescueResult.items.find(rescue => rescue.id === current.id) ?? null : null);
        if (availabilityResult) {
          setPolicy(availabilityResult.policy);
          setSession(current => current?.user.id === userId
            ? { ...current, user: { ...current.user,
                availabilityStatus: availabilityResult.status,
                availabilityPolicy: availabilityResult.policy } }
            : current);
        }
        setError('');
      } catch (e) {
        if (!closed && foreground) {
          setError(e instanceof Error ? e.message : 'Live rescue updates unavailable.');
        }
      } finally {
        inFlight = false;
        if (pending && !closed && foreground) {
          pending = false;
          void sync();
        }
      }
    };

    const connect = async () => {
      if (closed || !foreground) return;
      const currentGeneration = ++generation;
      try {
        const config = await getRealtimeConfig();
        if (closed || !foreground || currentGeneration !== generation) return;
        subscription = subscribeRescueChanges(config, {
          onChange: () => {
            void sync();
            // Refresh again after GSI propagation; no continuous polling
            // while the subscription is connected.
            if (delayedRefresh) clearTimeout(delayedRefresh);
            delayedRefresh = setTimeout(() => void sync(), 1500);
          },
          onConnected: () => void sync(),
          onStatus: online => { connected = online; }
        });
      } catch (e) {
        if (!closed && foreground && currentGeneration === generation) {
          console.warn('Realtime socket unavailable; fallback refresh enabled:', e);
          retryConfig = setTimeout(() => void connect(), 10_000);
        }
      }
    };

    void sync();
    void connect();
    // Reconcile periodically even with a live websocket: a dropped network
    // invalidation must not leave qualified field rescuers with a stale map.
    const fallback = setInterval(() => {
      if (foreground) void sync();
    }, 60_000);
    const appStateSubscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      if (active === foreground) return;
      foreground = active;
      if (active) {
        void sync();
        void connect();
      } else {
        ++generation;
        if (retryConfig) { clearTimeout(retryConfig); retryConfig = null; }
        if (delayedRefresh) { clearTimeout(delayedRefresh); delayedRefresh = null; }
        connected = false;
        subscription?.();
        subscription = null;
      }
    });
    return () => {
      closed = true;
      ++generation;
      clearInterval(fallback);
      if (retryConfig) clearTimeout(retryConfig);
      if (delayedRefresh) clearTimeout(delayedRefresh);
      appStateSubscription.remove();
      subscription?.();
    };
  }, [session?.user.id]);

  const sortedRescues = useMemo(() => [...rescues].sort((a,b) =>
    Number(b.assignedUserId === session?.user.id) - Number(a.assignedUserId === session?.user.id)
  ), [rescues, session?.user.id]);
  const myAssignedCount = rescues.filter(item => item.assignedUserId === session?.user.id).length;

  const teamNames = useMemo(() => {
    if (!session) return [];
    const ids = new Set(session.user.teamIds);
    return (session.membership?.teams ?? []).filter((team) => ids.has(team.id)).map((team) => team.name);
  }, [session]);

  async function handleLogin() {
    setBusy(true);
    setError('');
    try {
      const result = await login(email.trim(), password);
      setSession({ user: result.user, membership: result.membership });
      if (!result.user.roles?.includes('PUBLIC_REPORTER') &&
          !result.user.roles?.includes('VET_STAFF')) {
        setView('map');
        if (result.user.organisationId)
          void registerForPushNotifications().then(setPushStatus).catch(console.warn);
        const initial = await getRescues();
        setRescues(initial.items);
        setFeed(initial.feed ?? null);
        if (result.user.organisationId)
          await getAvailability().then(({ policy }) => setPolicy(policy)).catch(console.warn);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup() {
    setBusy(true); setError('');
    try {
      await signupReporter(reporterName.trim(), email.trim(), password);
      setPassword('');
      setAuthMode('verify');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create reporter account.'); }
    finally { setBusy(false); }
  }

  async function handleVerify() {
    setBusy(true); setError('');
    try {
      const result = await verifyReporter(email.trim(), verificationCode.trim());
      setSession(result);
      setAuthMode('signup');
      setVerificationCode('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not verify your email.'); }
    finally { setBusy(false); }
  }

  async function handleSocialLogin(provider: SocialProvider) {
    setBusy(true); setError('');
    try {
      const result = await loginSocialReporter(provider);
      if (result) setSession(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Social sign-in failed.');
    } finally { setBusy(false); }
  }

  async function handleClaim(id: string) {
    setBusy(true);
    setError('');
    setClaimNotice(null);
    try {
      const claimed = await claimRescue(id);
      const result = await getRescues().catch(() => null);
      if (result) {
        setRescues(result.items);
        setFeed(result.feed ?? null);
      }
      const mine = result?.items.find(item => item.id === id) ?? claimed.rescue;
      setSelectedMapRescue(null);
      setActiveRescue(mine);
    } catch (e) {
      setClaimNotice(claimNoticeFor(e));
      await getRescues().then((result) => {
        setRescues(result.items);
        setFeed(result.feed ?? null);
      }).catch(console.warn);
    } finally {
      setBusy(false);
    }
  }

  function releaseAssignedClaim(rescue: Rescue) {
    Alert.alert('Release rescue claim?', 'This is for uncollected rescues only. If an animal was physically collected, use the documented handover or correct an accidental pickup inside Manage animals.', [
      { text: 'Keep assignment', style: 'cancel' },
      { text: 'Release claim', style: 'destructive', onPress: () => {
        void (async () => {
          setBusy(true); setError('');
          try {
            await unclaimRescue(rescue.id);
            setSelectedMapRescue(null);
            setActiveRescue(null);
            await refresh();
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Could not release the claim.';
            setError(message);
            Alert.alert('Claim was not released', message);
          } finally { setBusy(false); }
        })();
      }}
    ]);
  }

  async function signOut() {
    await logout();
    setSession(null);
    setRescues([]);
    setActiveRescue(null);
    setSelectedMapRescue(null);
    setPolicy(null);
    setPushStatus(null);
    setFeed(null);
    setView('map');
    setAuthMode('signup');
    setError('');
    setClaimNotice(null);
  }

  async function refresh() {
    setError('');
    try {
      const [rescuesResult, availabilityResult] = await Promise.all([getRescues(), getAvailability()]);
      setRescues(rescuesResult.items);
      setFeed(rescuesResult.feed ?? null);
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
        <KeyboardAwareScrollView contentContainerStyle={styles.login} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>RESCUE HUB</Text>
          <Text style={styles.title}>
            {authMode === 'signup' ? 'Report injured wildlife' :
              authMode === 'verify' ? 'Verify your email' :
              authMode === 'rescuer' ? 'Rescuer sign in' : 'Welcome back'}
          </Text>
          <Text style={styles.copy}>
            {authMode === 'signup'
              ? 'Create a free account to report injured wildlife. You do not need to belong to a rescue organisation.'
              : authMode === 'verify'
                ? 'Enter the six-digit verification code sent to your email address.'
                : authMode === 'rescuer'
                  ? 'For registered rescue organisation volunteers and coordinators.'
                  : 'Sign in to your public wildlife reporting account.'}
          </Text>
          {authMode === 'signup' ? (
            <>
              <Text style={styles.fieldTitle}>Your name</Text>
              <KeyboardAwareTextInput style={styles.input} accessibilityLabel="Full name"
                autoCapitalize="words" value={reporterName} onChangeText={setReporterName} maxLength={100} />
            </>
          ) : null}
          <Text style={styles.fieldTitle}>Email address</Text>
          <KeyboardAwareTextInput style={styles.input} accessibilityLabel="Email address"
            autoCapitalize="none" keyboardType="email-address" value={email}
            onChangeText={setEmail} autoComplete="email" />
          {authMode === 'verify' ? (
            <>
              <Text style={styles.fieldTitle}>Six-digit verification code</Text>
              <KeyboardAwareTextInput style={styles.input} accessibilityLabel="Email verification code"
                value={verificationCode} onChangeText={setVerificationCode}
                keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
            </>
          ) : (
            <>
              <Text style={styles.fieldTitle}>Password</Text>
              <KeyboardAwareTextInput style={styles.input} accessibilityLabel="Password" secureTextEntry
                value={password} onChangeText={setPassword}
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} />
            </>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primaryButton} disabled={busy}
            onPress={() => void (authMode === 'signup' ? handleSignup() : authMode === 'verify' ? handleVerify() : handleLogin())}
            accessibilityRole="button">
            <Text style={styles.primaryButtonText}>
              {busy ? 'Please wait…' : authMode === 'signup' ? 'Create my free account' :
                authMode === 'verify' ? 'Verify and continue' :
                authMode === 'rescuer' ? 'Sign in as rescuer' : 'Sign in to report wildlife'}
            </Text>
          </Pressable>
          {authMode === 'verify' ? (
            <>
              <Pressable accessibilityRole="button" onPress={() => void handleSignup()}>
                <Text style={styles.modeLink}>Resend verification code</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setError(''); setAuthMode('signup'); }}>
                <Text style={styles.modeLink}>Back to account creation</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable accessibilityRole="button" onPress={() => {
                setError('');
                setAuthMode(authMode === 'signup' ? 'login' : 'signup');
              }}>
                <Text style={styles.modeLink}>
                  {authMode === 'signup' ? 'Already reported wildlife? Sign in' : 'New here? Create a free public account'}
                </Text>
              </Pressable>
              {authMode === 'rescuer' ? (
                <Pressable accessibilityRole="button" onPress={() => { setError(''); setAuthMode('login'); }}>
                  <Text style={styles.modeLink}>Sign in as a member of the public</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => { setError(''); setAuthMode('rescuer'); }}>
                  <Text style={styles.staffLink}>Rescuer or organisation member? Sign in</Text>
                </Pressable>
              )}
            </>
          )}
          {socialProviders.length > 0 && authMode !== 'verify' && authMode !== 'rescuer' ? (
            <View style={styles.socialOptions}>
              <Text style={styles.copy}>Or continue with:</Text>
              <View style={styles.socialRow}>
                {socialProviders.map(provider => (
                  <Pressable key={provider} accessibilityRole="button" disabled={busy}
                    style={styles.socialButton} onPress={() => void handleSocialLogin(provider)}>
                    <Text style={styles.socialButtonText}>
                      {provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : 'Facebook'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    );
  }

  if (session.user.roles?.includes('PUBLIC_REPORTER')) {
    return <SafeAreaView style={styles.root}>
      <PublicReporter onSignOut={signOut} />
    </SafeAreaView>;
  }

  const activateTab = (tab: 'rescues' | 'chats' | 'account') => {
    setActiveRescue(null);
    if (tab === 'rescues') { setView('map'); void refresh(); }
    else setView(tab === 'account' ? 'settings' : 'chats');
  };
  const bottom = (active: 'rescues' | 'chats' | 'account') =>
    keyboardVisible ? null : <BottomTabs active={active} onSelect={activateTab} />;

    const available = session.user.availabilityStatus === 'AVAILABLE';
  if (view === 'chats') return <SafeAreaView style={styles.root}>
    <OrganisationChats userId={session.user.id}
      onOpenRescue={(rescueId) => {
        const rescue = rescues.find(item => item.id === rescueId);
        if (!rescue) {
          Alert.alert('Rescue not available',
            'This rescue is not in your accessible rescue feed. Ask dispatch if you need access.');
          return;
        }
        setSelectedMapRescue(rescue);
        setView('map');
      }} />
    {bottom('chats')}
  </SafeAreaView>;

  if (view === 'settings') return <SafeAreaView style={styles.root}><AvailabilitySettings
    onBack={() => { setView('map'); void refresh(); }}
    onSignOut={signOut}
    pushStatus={pushStatus}
    onRetryPush={async () => {
      const result = await registerForPushNotifications();
      setPushStatus(result);
      return result;
    }}
    onSave={(savedPolicy, status) => {
      setPolicy(savedPolicy);
      setSession({ ...session, user: { ...session.user, availabilityStatus: status, availabilityPolicy: savedPolicy } });
    }}
  />{bottom('account')}</SafeAreaView>;

  if (view === 'care' && session.user.roles?.includes('CARER')) return <SafeAreaView style={styles.root}>
    <CarerOffers userId={session.user.id} onBack={() => { setView('map'); void refresh(); }}
      onChanged={() => void refresh()} />
    {bottom('rescues')}
  </SafeAreaView>;

    if (activeRescue) return <SafeAreaView style={styles.root}><AnimalCare
    rescue={activeRescue}
    userId={session.user.id}
    roles={session.user.roles ?? []}
    onBack={() => { setActiveRescue(null); void refresh(); }}
    onUnclaim={() => {
      setActiveRescue(null);
      setSelectedMapRescue(null);
      void refresh();
    }}
  />{bottom('rescues')}</SafeAreaView>;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <Modal visible={claimNotice !== null} transparent animationType="fade"
        statusBarTranslucent onRequestClose={() => setClaimNotice(null)}>
        <View style={styles.claimModalBackdrop}>
          <View style={styles.claimModalCard} accessibilityViewIsModal>
            <Text style={styles.claimModalTitle} accessibilityRole="header">{claimNotice?.title}</Text>
            <Text style={styles.claimModalMessage}>{claimNotice?.message}</Text>
            <Pressable style={styles.claimModalButton} accessibilityRole="button"
              accessibilityLabel="Close rescue claim notice" onPress={() => setClaimNotice(null)}>
              <Text style={styles.claimModalButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
        {session.user.roles?.includes('CARER') ? (
          <Pressable style={[styles.viewButton,view==='care' && styles.viewSelected]}
            onPress={() => setView('care')} accessibilityRole="button"
            accessibilityState={{selected:view==='care'}}>
            <Text style={[styles.viewText,view==='care' && styles.viewTextSelected]}>Care offers</Text>
          </Pressable>
        ) : null}
      </View>

      {myAssignedCount > 0 ? (
        <Pressable style={styles.assignmentBanner} accessibilityRole="button"
          onPress={() => setView('list')}>
          <Text style={styles.assignmentBannerText}>My assignments: {myAssignedCount} · View assigned rescues</Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {!error && feed && rescues.length === 0 ? (
        <Text style={styles.feedNotice}>
          {feed.pendingRescues === 0
            ? 'There are no pending rescues in your organisation.'
            : feed.qualifiedPending === 0
              ? 'There are pending rescues, but none match your assigned dispatch teams.'
              : !feed.canBrowse
                ? 'Your account needs an active rescue or care role to browse these cases.'
                : 'No visible rescues. Check membership and organisation settings.'}
          {'  '}Feed: {feed.source}.
        </Text>
      ) : null}
      {view === 'map' ? (
        <View style={styles.mapBody}>
          <RescueMap rescues={rescues.filter(shouldShowRescuePin)} onSelect={setSelectedMapRescue} />
          {selectedMapRescue && shouldShowRescuePin(selectedMapRescue) ? (
            <View style={styles.selectedRescue}>
              <View style={styles.selectedHeading}>
                <Text style={styles.animal} numberOfLines={1}>{selectedMapRescue.type}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close rescue details"
                  onPress={() => setSelectedMapRescue(null)} style={styles.dismiss}>
                  <Text style={styles.dismissText}>×</Text>
                </Pressable>
              </View>
              <RescueAddress id={selectedMapRescue.id} latitude={selectedMapRescue.latitude}
                 longitude={selectedMapRescue.longitude} location={selectedMapRescue.location} showDirections />
              <Text style={styles.injury} numberOfLines={2}>{selectedMapRescue.injury || 'Condition not recorded'}</Text>
              {selectedMapRescue.stageLabel ? <Text style={styles.stage}>{selectedMapRescue.stageLabel}</Text> : null}
              {selectedMapRescue.status === 'PENDING' ? available ? (
                <Pressable style={styles.claimButton} disabled={busy} onPress={() => handleClaim(selectedMapRescue.id)}
                  accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>{busy ? 'Please wait…' : 'Claim rescue'}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.claimButton} onPress={() => setView('settings')} accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>Change availability in Settings to claim</Text>
                </Pressable>
              ) : (selectedMapRescue.assignedUserId === session.user.id || selectedMapRescue.custodyRole === 'CUSTODIAN') ? (
                <>
                <Pressable style={styles.claimButton} onPress={() => setActiveRescue(selectedMapRescue)}
                  accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>Manage animals and care history</Text>
                </Pressable>
                {selectedMapRescue.status === 'ASSIGNED' && !selectedMapRescue.pickedUpAt ? (
                  <Pressable style={styles.headerAction} accessibilityRole="button" disabled={busy}
                    onPress={() => releaseAssignedClaim(selectedMapRescue)}>
                    <Text style={styles.headerActionText}>Release my claim</Text>
                  </Pressable>
                ) : null}
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={sortedRescues}
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
              <RescueAddress id={item.id} latitude={item.latitude}
                 longitude={item.longitude} location={item.location} showDirections />
              <Text style={styles.injury}>{item.injury || 'Condition not recorded'}</Text>
              {item.stageLabel ? <Text style={styles.stage}>{item.stageLabel}</Text> : null}
              {item.status === 'PENDING' ? (
                <Pressable style={styles.claimButton} disabled={busy || !available} onPress={() => handleClaim(item.id)}>
                  <Text style={styles.primaryButtonText}>{busy ? 'Please wait…' : available ? 'Claim rescue' : 'Available in Settings to claim'}</Text>
                </Pressable>
              ) : (item.assignedUserId === session.user.id || item.custodyRole === 'CUSTODIAN') ? (
                <>
                  <Text style={styles.mine}>Responsible for this case · response or care in progress</Text>
                  <Pressable style={styles.claimButton} onPress={() => setActiveRescue(item)}>
                    <Text style={styles.primaryButtonText}>Manage animals and care history</Text>
                  </Pressable>
                  {item.status === 'ASSIGNED' && !item.pickedUpAt ? (
                    <Pressable style={styles.headerAction} accessibilityRole="button" disabled={busy}
                      onPress={() => releaseAssignedClaim(item)}>
                      <Text style={styles.headerActionText}>Release my claim</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </View>
          )}
        />
      )}
      {bottom('rescues')}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#edf1ee' },
  assignmentBanner: {backgroundColor:'#dceae1',borderColor:'#91b39d',borderWidth:1,marginHorizontal:12,marginVertical:6,padding:12,borderRadius:10},
  assignmentBannerText: {color:'#173d2c',fontSize:14,fontWeight:'800'},
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  login: { flexGrow: 1, justifyContent: 'center', padding: 28, gap: 12, paddingBottom: 56 },
  kicker: { color: '#648074', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#17211d', fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  copy: { color: '#66736c', fontSize: 13, lineHeight: 19 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e1dc', borderRadius: 12, padding: 14 },
  fieldTitle: { color: '#173d2c', fontSize: 13, fontWeight: '800' },
  modeLink: { color: '#24583f', fontWeight: '800', fontSize: 13, textAlign: 'center', paddingVertical: 9 },
  staffLink: { color: '#5d7064', fontWeight: '600', fontSize: 12, textAlign: 'center', paddingVertical: 10 },
  socialOptions: { marginTop: 14, gap: 8 },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  socialButton: { backgroundColor: '#fff', borderColor: '#d9e1dc', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  socialButtonText: { color: '#173d2c', fontSize: 13, fontWeight: '800' },
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
  stage: { color: '#24583f', fontSize: 12, marginTop: 6, fontWeight: '800' },
  empty: { textAlign: 'center', color: '#76837b', paddingVertical: 40 },
  claimButton: { backgroundColor: '#173d2c', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  mine: { color: '#24583f', fontWeight: '700', marginTop: 12 },
  errorBanner: { color: '#a23f35', paddingHorizontal: 20, paddingTop: 10 },
  claimModalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 24, backgroundColor: 'rgba(14, 29, 22, 0.5)' },
  claimModalCard: { width: '100%', maxWidth: 380, padding: 24, borderRadius: 18,
    backgroundColor: '#fff', gap: 14, shadowColor: '#000',
    shadowOpacity: 0.2, shadowRadius: 18, elevation: 12 },
  claimModalTitle: { color: '#173d2c', fontSize: 20, fontWeight: '800' },
  claimModalMessage: { color: '#435249', fontSize: 15, lineHeight: 23 },
  claimModalButton: { marginTop: 6, alignSelf: 'stretch', minHeight: 48,
    backgroundColor: '#173d2c', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  claimModalButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  feedNotice: { color: '#4b6555', backgroundColor: '#fff', fontSize: 12, padding: 10 },
  rescueList: { flex: 1 }
});
