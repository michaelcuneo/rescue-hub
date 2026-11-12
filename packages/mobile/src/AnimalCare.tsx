import ReporterConversation from './ReporterConversation';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { KeyboardAwareScrollView, KeyboardAwareTextInput } from './KeyboardAware';
import RescueAddress from './RescueAddress';
import {
  acceptAnimalTransfer, addAnimalNote, getAnimalHistory, getRescueAnimals, confirmRescuePickup, getCareDelivery, type CareDeliveryDestination,
  recordAnimalOutcome, registerAnimal, requestAnimalTransfer, startVetTransport, recordVetDropoff, recordVetAssessment, unclaimRescue,
  correctAnimalIdentification, correctReportedRescue, getRescuerReporterContact, quickVetProgress,
  getEligibleCarers, startPersonalCare, type Animal, type AnimalEvent, type Rescue
} from './api';

type Props = { rescue: Rescue; userId: string; roles: string[]; onBack: () => void; onUnclaim: () => void };
const eventTypes = ['OBSERVATION', 'VET_ASSESSMENT', 'TREATMENT', 'FEEDING', 'WEIGHT', 'REVIEW'] as const;
const outcomes = ['RELEASED', 'EUTHANISED', 'DECEASED'] as const;
const terminal = new Set<string>(outcomes);

export default function AnimalCare({ rescue, userId, roles, onBack, onUnclaim }: Props) {
  const [conversationOpen, setConversationOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'destination' | 'carer' | null>(null);
  const [nextStep, setNextStep] = useState<'VET' | 'CARER' | 'SELF' | 'RELEASE'>('VET');
  const [guideAnimalId, setGuideAnimalId] = useState<string | null>(null);
  const [guideStatus, setGuideStatus] = useState<string | null>(null);
  const [carers, setCarers] = useState<{ id: string; name: string }[]>([]);
  const [carerId, setCarerId] = useState('');
  const [releaseLocation, setReleaseLocation] = useState('');
  const [releaseCoords, setReleaseCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [releaseNotes, setReleaseNotes] = useState('');

  const [deliveryInfo, setDeliveryInfo] = useState<(CareDeliveryDestination & { carerUserId: string }) | null>(null);
  const [collected, setCollected] = useState(Boolean(rescue.pickedUpAt));
  const [collectionNotes, setCollectionNotes] = useState('');
  const [reporterContact, setReporterContact] = useState<{ reportId: string; allowMessages: boolean; contactPhone: string | null } | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [selected, setSelected] = useState<Animal | null>(null);
  const [events, setEvents] = useState<AnimalEvent[]>([]);
  const [species, setSpecies] = useState(rescue.type ?? '');
  const [description, setDescription] = useState('');
  const [incidentSpecies, setIncidentSpecies] = useState(rescue.type);
  const [incidentCondition, setIncidentCondition] = useState(rescue.injury ?? '');
  const [correctedSpecies, setCorrectedSpecies] = useState('');
  const [correctedDescription, setCorrectedDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [eventType, setEventType] = useState<(typeof eventTypes)[number]>('OBSERVATION');
  const [recipientId, setRecipientId] = useState('');
  const [destination, setDestination] = useState('');
  const [vetLocation, setVetLocation] = useState('');
  const [quickVetNotes, setQuickVetNotes] = useState('');
  const [quickMessage, setQuickMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [transferPurpose, setTransferPurpose] = useState<'CARE' | 'TRANSPORT'>('CARE');
  const [unclaimReason, setUnclaimReason] = useState('');
  const [outcome, setOutcome] = useState<(typeof outcomes)[number]>('RELEASED');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rescue.transportAnimalId || rescue.assignedUserId !== userId) return;
    void getCareDelivery(rescue.transportAnimalId).then(result => {
      setDeliveryInfo(result.destination);
      setRecipientId(result.destination.carerUserId);
      setDestination(result.destination.address);
      setTransferPurpose('CARE');
    }).catch(() => {});
  }, [rescue.transportAnimalId, rescue.assignedUserId, userId]);

  useEffect(() => {
    if (!rescue.id.startsWith('public-report-') || rescue.assignedUserId !== userId) return;
    void getRescuerReporterContact(rescue.id).then(result => setReporterContact(result.contact)).catch(() => {});
  }, [rescue.id, rescue.assignedUserId, userId]);

  const refresh = useCallback(async (id?: string) => {
    const result = await getRescueAnimals(rescue.id);
    setAnimals(result.items);
    if (id) {
      const history = await getAnimalHistory(id);
      setSelected(history.animal);
      setCorrectedSpecies(history.animal.species);
      setCorrectedDescription(history.animal.description ?? '');
      setEvents(history.events);
      if (rescue.transportAnimalId) {
        const delivery = await getCareDelivery(id).catch(() => null);
        setDeliveryInfo(delivery?.destination ?? null);
        if (delivery?.destination) {
          setRecipientId(delivery.destination.carerUserId);
          setDestination(delivery.destination.address);
          setTransferPurpose('CARE');
        }
      }
    }
  }, [rescue.id, rescue.transportAnimalId]);

  useEffect(() => {
    let active = true;
    getRescueAnimals(rescue.id).then((result) => {
      if (active) setAnimals(result.items);
    }).catch((e: unknown) => {
      if (active) setError(e instanceof Error ? e.message : 'Unable to load animals.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [rescue.id]);

  async function run(action: () => Promise<unknown>, selectedId?: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh(selectedId);
      setNotes('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }

  async function openAnimal(id: string) {
    setBusy(true);
    setError('');
    try {
      const history = await getAnimalHistory(id);
      setSelected(history.animal);
      setEvents(history.events);
      if (rescue.transportAnimalId) {
        const delivery = await getCareDelivery(id).catch(() => null);
        setDeliveryInfo(delivery?.destination ?? null);
        if (delivery?.destination) {
          setRecipientId(delivery.destination.carerUserId);
          setDestination(delivery.destination.address);
          setTransferPurpose('CARE');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load animal history.');
    } finally {
      setBusy(false);
    }
  }

  async function releaseClaim() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await unclaimRescue(rescue.id, unclaimReason);
      onUnclaim();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to release claim.');
    } finally {
      setBusy(false);
    }
  }

  if (conversationOpen && rescue.id.startsWith('public-report-')) {
    return <ReporterConversation reportId={rescue.id.slice('public-report-'.length)} onBack={() => setConversationOpen(false)} />;
  }

  useEffect(() => {
    if (nextStep !== 'CARER' || !collected || rescue.transportAnimalId) return;
    getEligibleCarers().then(result => setCarers(result.carers))
      .catch(error => setError(error instanceof Error ? error.message : 'Could not load carers.'));
  }, [nextStep, collected, rescue.transportAnimalId]);
  const isCustodian = selected?.currentCustodianUserId === userId;
  const activeAnimal = selected ?? (animals.length === 1 ? animals[0] : null);
  const canQuickProgress = rescue.assignedUserId === userId && collected && !rescue.transportAnimalId &&
    (activeAnimal ? activeAnimal.currentCustodianUserId === userId &&
      ['IN_RESCUE','IN_TRANSIT'].includes(activeAnimal.status) : animals.length === 0);
  async function saveQuickVet(kind: 'GOING_TO_VET' | 'HANDED_TO_VET') {
    if (kind === 'HANDED_TO_VET' && !vetLocation.trim()) {
      setError('Enter the veterinary clinic or receiving person first.');
      return;
    }
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await quickVetProgress(rescue.id, kind, vetLocation.trim(),
        quickVetNotes.trim(), activeAnimal?.id);
      await refresh(result.animal.id);
      setQuickMessage(result.message);
      setQuickVetNotes('');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to save veterinary update.');
    } finally {
      setBusy(false);
    }
  }
  const guideAnimal = animals.find(animal => animal.id === guideAnimalId) ?? activeAnimal;
  const effectiveStatus = guideStatus ?? guideAnimal?.status ?? 'IN_RESCUE';
  const isFinal = selected ? terminal.has(selected.status) : false;

  async function nextAction() {
    const animalId = guideAnimalId ?? guideAnimal?.id;
    if (!animalId) { setError('Animal registration is still loading. Refresh this rescue and try again.'); return; }
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (nextStep === 'VET') {
        if (!vetLocation.trim()) throw new Error('Enter the veterinary clinic or destination.');
        if (effectiveStatus === 'IN_TRANSIT') {
          await recordVetDropoff(animalId, vetLocation.trim(), quickVetNotes.trim());
          setGuideStatus('AT_VET');
          setQuickMessage('Veterinary handover recorded. The animal remains in the care system.');
        } else {
          await startVetTransport(animalId, vetLocation.trim(), quickVetNotes.trim());
          setGuideStatus('IN_TRANSIT');
          setQuickMessage('Travelling to the vet. Confirm the handover when the clinic receives the animal.');
        }
      } else if (nextStep === 'CARER') {
        if (!carerId) throw new Error('Choose the receiving carer.');
        await requestAnimalTransfer(animalId, carerId, destination.trim(), quickVetNotes.trim(), 'CARE');
        setQuickMessage('Handover requested. You retain custody until the carer accepts.');
      } else if (nextStep === 'SELF') {
        if (!roles.includes('CARER')) throw new Error('You need an active carer role to start personal care.');
        await startPersonalCare(animalId, quickVetNotes.trim());
        setGuideStatus('IN_CARE');
        setQuickMessage('Animal added to your care records.');
      } else {
        if (!releaseLocation.trim()) throw new Error('Record where the animal was actually released.');
        if (!releaseNotes.trim()) throw new Error('Add a brief reason for the release or relocation.');
        await recordAnimalOutcome(animalId, 'RELEASED', releaseNotes.trim(), {
          location: releaseLocation.trim(), ...(releaseCoords ?? {})
        });
        setGuideStatus('RELEASED');
        setQuickMessage('Wildlife release recorded. The original rescue and release locations are preserved.');
      }
      await refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to save next step.');
    } finally {
      setBusy(false);
    }
  }

  async function useReleaseGps() {
    setBusy(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location permission was denied. You can enter the release location manually.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coordinates = {
        latitude: position.coords.latitude, longitude: position.coords.longitude
      };
      setReleaseCoords(coordinates);
      setReleaseLocation(`${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to get current GPS position.');
    } finally {
      setBusy(false);
    }
  }


  return (
    <KeyboardAwareScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Modal visible={pickerMode !== null} transparent animationType="fade"
        onRequestClose={() => setPickerMode(null)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.quickTitle}>{pickerMode === 'carer' ? 'Receiving carer' : 'What happens next?'}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {pickerMode === 'destination' ? ([
                { value: 'VET', label: 'Take to veterinary clinic' },
                { value: 'CARER', label: 'Transfer to another carer' },
                ...(roles.includes('CARER') ? [{ value: 'SELF', label: 'Care for it myself' }] : []),
                { value: 'RELEASE', label: 'Release into the wild / relocate' }
              ] as const).map(option => (
                <Pressable key={option.value} style={styles.modalOption} accessibilityRole="button"
                  onPress={() => { setNextStep(option.value); setPickerMode(null); }}>
                  <Text style={styles.dropdownText}>{option.label}</Text>
                </Pressable>
              )) : carers.map(carer => (
                <Pressable key={carer.id} style={styles.modalOption} accessibilityRole="button"
                  onPress={() => { setCarerId(carer.id); setPickerMode(null); }}>
                  <Text style={styles.dropdownText}>{carer.name}</Text>
                </Pressable>
              ))}
              {pickerMode === 'carer' && !carers.length ? <Text style={styles.muted}>No eligible carers are currently available.</Text> : null}
            </ScrollView>
            <Pressable style={styles.secondaryButton} accessibilityRole="button"
              onPress={() => setPickerMode(null)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Pressable onPress={selected ? () => { setSelected(null); setEvents([]); setError(''); } : onBack}>
        <Text style={styles.link}>‹ {selected ? 'All animals' : 'Rescues'}</Text>
      </Pressable>
      <Text style={styles.heading}>{selected ? selected.species : rescue.type}</Text>
      <Text style={styles.muted}>{selected ? `Status: ${selected.status.replace(/_/g, ' ')}` : 'Rescue location'}</Text>
       <RescueAddress id={rescue.id} latitude={rescue.latitude}
         longitude={rescue.longitude} location={rescue.location} showDirections />
      {reporterContact?.allowMessages ? (
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setConversationOpen(true)}>
          <Text style={styles.buttonText}>Message the person who reported this rescue</Text>
        </Pressable>
      ) : null}
      {reporterContact?.contactPhone ? (
        <Pressable accessibilityRole="button" onPress={() => void Linking.openURL('tel:' + reporterContact.contactPhone)}>
          <Text style={styles.link}>Call consenting reporter: {reporterContact.contactPhone}</Text>
        </Pressable>
      ) : null}
      {rescue.transportAnimalId ? <View style={styles.card}>
        <Text style={styles.section}>Transport pickup job</Text>
        <Text style={styles.muted}>This animal already has a permanent record. Claiming transport reserves the pickup, but does not transfer custody. Once you physically collect it at the vet, confirm pickup and deliver it to the nominated carer.</Text>
        {deliveryInfo ? <>
          <Text style={styles.body}>Deliver to: {deliveryInfo.address} ({deliveryInfo.mode.replace(/_/g,' ').toLowerCase()})\nGPS: {deliveryInfo.latitude.toFixed(5)}, {deliveryInfo.longitude.toFixed(5)}</Text>
          <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(
            'https://www.google.com/maps/dir/?api=1&destination=' +
            encodeURIComponent(`${deliveryInfo.latitude},${deliveryInfo.longitude}`)
          )}><Text style={styles.link}>Directions to nominated carer</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => {
            if (!rescue.transportAnimalId) return;
            void getCareDelivery(rescue.transportAnimalId).then(result => {
              setDeliveryInfo(result.destination);
              setRecipientId(result.destination.carerUserId);
              setDestination(result.destination.address);
              setTransferPurpose('CARE');
            }).catch(e => setError(e instanceof Error ? e.message : 'Could not refresh delivery instructions.'));
          }}><Text style={styles.link}>Refresh carer delivery location</Text></Pressable>
        </> : null}
      </View> : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {loading ? <ActivityIndicator /> : null}
      {rescue.status === 'ASSIGNED' && rescue.assignedUserId === userId && !rescue.transportAnimalId && !selected ? (
        <View style={styles.quickPanel}>
          <Text style={styles.quickTitle}>{collected ? 'What happens next?' : 'Pick up animal'}</Text>
          {!collected ? (
            <>
              <Text style={styles.muted}>Confirm physical collection. The animal is registered automatically, and the rescue pin disappears.</Text>
              {animals.length === 0 ? <>
                <Text style={styles.fieldLabel}>Animal species / type *</Text>
                <KeyboardAwareTextInput style={styles.input} value={species} onChangeText={setSpecies}
                  maxLength={120} placeholder="Animal species or type" accessibilityLabel="Animal species or type" />
                <Text style={styles.fieldLabel}>Identifying details (optional)</Text>
                <KeyboardAwareTextInput style={styles.input} value={description} onChangeText={setDescription}
                  maxLength={2000} multiline placeholder="Size, markings, observed injury" accessibilityLabel="Identifying details" />
              </> : <Text style={styles.muted}>Existing registered animal: {animals.map(a => a.species).join(', ')}</Text>}
              <KeyboardAwareTextInput style={styles.input} value={collectionNotes} onChangeText={setCollectionNotes}
                maxLength={1000} multiline placeholder="Pickup notes (optional)" accessibilityLabel="Pickup notes" />
              <Pressable style={styles.button} disabled={busy || (animals.length === 0 && !species.trim())}
                accessibilityRole="button" onPress={() => Alert.alert(
                  'Confirm animal pickup?', 'This records physical collection and registers the first animal. The operational map pin will be removed.',
                  [{ text: 'Cancel', style: 'cancel' }, { text: 'Pick up animal', onPress: () => void run(async () => {
                    const result = await confirmRescuePickup(rescue.id, collectionNotes,
                      animals.length ? undefined : { species: species.trim(), description: description.trim() });
                    setGuideAnimalId(result.animal?.id ?? animals[0]?.id ?? null);
                    setGuideStatus(result.animal?.status ?? animals[0]?.status ?? 'IN_RESCUE');
                    setCollected(true);
                  }) }]
                )}>
                <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Confirm pickup & register'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.muted}>The animal is collected and stays in the permanent history. Choose its next destination.</Text>
              {animals.length > 1 && !guideAnimalId ? <Text style={styles.warning}>This incident has multiple animals. Select one from the list below before recording its destination.</Text> : null}
              <Text style={styles.fieldLabel}>Next step</Text>
              <Pressable style={styles.dropdown} accessibilityRole="button" accessibilityLabel="Choose next step"
                onPress={() => setPickerMode('destination')}>
                <Text style={styles.dropdownText}>{({
                  VET: 'Take to veterinary clinic', CARER: 'Transfer to a carer',
                  SELF: 'Care for it myself', RELEASE: 'Release into wild / relocate'
                })[nextStep]}  ▾</Text>
              </Pressable>
              {nextStep === 'VET' && effectiveStatus !== 'AT_VET' && <>
                <Text style={styles.fieldLabel}>Veterinary destination *</Text>
                <KeyboardAwareTextInput style={styles.input} value={vetLocation} onChangeText={setVetLocation}
                  maxLength={250} placeholder="e.g. AREC, Broadmeadow" accessibilityLabel="Veterinary destination" />
              </>}
              {nextStep === 'CARER' && <>
                <Text style={styles.fieldLabel}>Receiving carer *</Text>
                <Pressable style={styles.dropdown} accessibilityRole="button"
                  onPress={() => setPickerMode('carer')}>
                  <Text style={styles.dropdownText}>{carers.find(c => c.id === carerId)?.name ?? 'Select registered carer'}  ▾</Text>
                </Pressable>
                <Text style={styles.fieldLabel}>Handover location (optional)</Text>
                <KeyboardAwareTextInput style={styles.input} value={destination} onChangeText={setDestination}
                  maxLength={250} placeholder="Where the carer will receive the animal" />
              </>}
              {nextStep === 'RELEASE' && <>
                <Text style={styles.fieldLabel}>Actual release / relocation location *</Text>
                <KeyboardAwareTextInput style={styles.input} value={releaseLocation}
                  onChangeText={value => { setReleaseLocation(value); setReleaseCoords(null); }}
                  maxLength={250} placeholder="GPS coordinates or specific place" accessibilityLabel="Actual wildlife release location" />
                <Pressable style={styles.secondaryButton} accessibilityRole="button" disabled={busy}
                  onPress={() => void useReleaseGps()}>
                  <Text style={styles.secondaryButtonText}>Use current GPS location</Text>
                </Pressable>
                <Text style={styles.muted}>This is recorded separately from the original incident location.</Text>
                <Text style={styles.fieldLabel}>Reason / release notes *</Text>
                <KeyboardAwareTextInput style={[styles.input,styles.multilineInput]} value={releaseNotes}
                  onChangeText={setReleaseNotes} maxLength={4000} multiline
                  placeholder="e.g. Healthy brown snake relocated to suitable habitat"
                  accessibilityLabel="Reason for wildlife release" />
              </>}
              {nextStep !== 'RELEASE' && effectiveStatus !== 'AT_VET' && <>
                <Text style={styles.fieldLabel}>Notes (optional)</Text>
                <KeyboardAwareTextInput style={styles.input} value={quickVetNotes} onChangeText={setQuickVetNotes}
                  maxLength={1000} multiline placeholder="Observations or handover notes" />
              </>}
              {effectiveStatus === 'AT_VET' ? <Text style={styles.success}>At veterinary clinic. Awaiting assessment or collection instructions.</Text> :
                effectiveStatus === 'IN_CARE' ? <Text style={styles.success}>In your care. Continue in the animal care record.</Text> :
                effectiveStatus === 'RELEASED' ? <Text style={styles.success}>Released into the wild. Outcome is recorded.</Text> :
                <Pressable style={styles.button} disabled={busy || !guideAnimalId && animals.length !== 1 ||
                  nextStep === 'VET' && !vetLocation.trim() ||
                  nextStep === 'CARER' && !carerId ||
                  nextStep === 'RELEASE' && (!releaseLocation.trim() || !releaseNotes.trim())}
                  accessibilityRole="button" onPress={() => {
                    if (nextStep === 'RELEASE') Alert.alert('Confirm wildlife release?',
                      'Confirm the animal was physically released at the recorded location. This is a final outcome.',
                      [{ text: 'Not yet', style: 'cancel' }, { text: 'Confirm release', onPress: () => void nextAction() }]);
                    else void nextAction();
                  }}>
                  <Text style={styles.buttonText}>{busy ? 'Saving…' :
                    nextStep === 'VET' ? effectiveStatus === 'IN_TRANSIT' ? 'Confirm vet handover' : 'Start vet transport' :
                    nextStep === 'CARER' ? 'Request carer handover' :
                    nextStep === 'SELF' ? 'Start my care record' : 'Confirm wildlife release'}</Text>
                </Pressable>}
              {quickMessage ? <Text style={styles.success}>{quickMessage}</Text> : null}
            </>
          )}
        </View>
      ) : null}
      {!selected ? <>
        <Text style={styles.section}>Animals in this rescue ({animals.length})</Text>
        {animals.map(animal => (
          <Pressable key={animal.id} style={styles.card} onPress={() => {
            if (collected && rescue.assignedUserId === userId && animals.length > 1) {
              setGuideAnimalId(animal.id); setGuideStatus(animal.status);
            } else void openAnimal(animal.id);
          }}>
            <Text style={styles.bold}>{animal.species}</Text>
            <Text style={styles.muted}>{animal.status.replace(/_/g, ' ')}</Text>
            <Text style={styles.link}>{animals.length > 1 && collected ? 'Select for next step ›' : 'View care history ›'}</Text>
          </Pressable>
        ))}
        {collected ? (
          <Pressable style={styles.advancedToggle} accessibilityRole="button"
            onPress={() => setShowAdvanced(value => !value)}>
            <Text style={styles.advancedToggleText}>{showAdvanced ? 'Hide detailed animal registration' : 'Additional animal / correction'}</Text>
          </Pressable>
        ) : null}
        {showAdvanced && collected && rescue.assignedUserId === userId && !rescue.transportAnimalId ? (
          <View style={styles.card}>
            <Text style={styles.section}>Register an additional animal</Text>
            <KeyboardAwareTextInput style={styles.input} value={species} onChangeText={setSpecies}
              placeholder="Animal species or type" maxLength={120} />
            <KeyboardAwareTextInput style={styles.input} value={description} onChangeText={setDescription}
              placeholder="Identifying details" multiline maxLength={2000} />
            <Pressable style={styles.button} disabled={busy || !species.trim()} onPress={() => void run(async () => {
              const registered = await registerAnimal(rescue.id, species.trim(), description.trim());
              setGuideAnimalId(registered.animal.id); setGuideStatus(registered.animal.status);
              setSpecies(''); setDescription('');
            })}>
              <Text style={styles.buttonText}>Add another animal</Text>
            </Pressable>
          </View>
        ) : null}
        {!collected && rescue.assignedUserId === userId && animals.length === 0 ? (
          <Pressable style={styles.secondaryButton} accessibilityRole="button"
            onPress={() => Alert.alert('Release rescue claim?', 'Return this uncollected rescue to the available queue.',
              [{ text: 'Keep rescue', style: 'cancel' }, { text: 'Release claim', style: 'destructive', onPress: () => void releaseClaim() }])}>
            <Text style={styles.secondaryButtonText}>Release uncollected claim</Text>
          </Pressable>
        ) : null}
      </> : (
        <>
          <Pressable style={styles.advancedToggle} accessibilityRole="button" accessibilityState={{expanded:showAdvanced}}
            onPress={() => setShowAdvanced(value => !value)}>
            <Text style={styles.advancedToggleText}>{showAdvanced ? 'Hide detailed care forms' : 'More options: detailed care records and transfers'}</Text>
          </Pressable>
          {showAdvanced ? <>
          <View style={styles.card}>
            <Text style={styles.section}>Correct the animal identification</Text>
            <Text style={styles.muted}>The public report remains unchanged; all corrections are recorded in the animal history.</Text>
            <KeyboardAwareTextInput style={styles.input} value={correctedSpecies} onChangeText={setCorrectedSpecies} maxLength={120} accessibilityLabel="Corrected animal species" placeholder="Confirmed species" />
            <KeyboardAwareTextInput style={[styles.input,styles.multilineInput]} value={correctedDescription} onChangeText={setCorrectedDescription} maxLength={2000} multiline accessibilityLabel="Corrected identifying details" placeholder="Identifying details or corrected condition" />
            <Pressable style={styles.button} disabled={busy || !correctedSpecies.trim() || !isCustodian || isFinal}
              onPress={() => void run(() => correctAnimalIdentification(selected!.id, correctedSpecies, correctedDescription), selected!.id)}>
              <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Save verified identification'}</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            <Text style={styles.section}>Current custody</Text>
            <Text style={styles.muted}>Physical location: {selected.physicalCustodianType === 'VET'
              ? `Veterinary clinic — ${selected.physicalCustodianName || selected.currentLocation || 'not specified'}`
              : isCustodian ? 'With you' : selected.currentLocation || 'With assigned custodian'}</Text>
            {selected.physicalCustodianType === 'VET' ? <Text style={styles.muted}>
              The clinic has the animal. The organisation remains responsible for follow-up until its next verified handover.
            </Text> : null}
            <Text style={styles.muted}>Location: {selected.currentLocation || 'Not recorded'}</Text>
            <Text style={styles.muted}>Updated: {new Date(selected.updatedAt).toLocaleString()}</Text>
            {selected.vetStage === 'AWAITING_ASSESSMENT' ?
              <Text style={styles.warning}>At vet · awaiting assessment</Text> : null}
            {selected.vetStage === 'ASSESSED_AWAITING_TRANSPORT' ?
              <Text style={styles.warning}>Assessed · awaiting transport</Text> : null}
            {selected.pendingTransferId ? <Text style={styles.warning}>Custody transfer awaiting acknowledgement</Text> : null}
          </View>
          <Text style={styles.section}>Care history</Text>
          {events.map((event) => (
            <View style={styles.card} key={event.id}>
              <Text style={styles.bold}>{event.type.replace(/_/g, ' ')}</Text>
              <Text style={styles.muted}>{new Date(event.occurredAt || event.createdAt).toLocaleString()}</Text>
              {event.type === 'PHONE_UPDATE' && event.callerName ? <Text style={styles.muted}>Caller: {event.callerName} · {event.callerRole ?? 'Phone'}</Text> : null}
              {event.notes ? <Text style={styles.body}>{event.notes}</Text> : null}
              {event.type === 'PHONE_UPDATE' && event.callbackPermitted && event.callbackPhone ? (
                <Pressable accessibilityRole="button" onPress={() => void Linking.openURL('tel:' + event.callbackPhone)}>
                  <Text style={styles.link}>Call consenting caller: {event.callbackPhone}</Text>
                </Pressable>
              ) : null}
              {event.transportRescueId ? <Text style={styles.muted}>A transport job was offered to volunteers for this animal.</Text> : null}
              {event.outcome ? <Text style={styles.body}>Outcome: {event.outcome}</Text> : null}
            </View>
          ))}
          {isCustodian && !isFinal && !selected.pendingTransferId ? (
            <>
              <View style={styles.card}>
                <Text style={styles.section}>Add care note</Text>
                <View style={styles.chips}>
                  {eventTypes.map((type) => (
                    <Pressable key={type} onPress={() => setEventType(type)} style={[styles.chip, eventType === type && styles.chipSelected]}>
                      <Text style={eventType === type ? styles.chipTextSelected : styles.chipText}>{type.replace(/_/g, ' ')}</Text>
                    </Pressable>
                  ))}
                </View>
                <KeyboardAwareTextInput style={styles.input} placeholder="Care observations or treatment notes *" multiline value={notes} onChangeText={setNotes} maxLength={4000} />
                <Pressable style={styles.button} disabled={busy || !notes.trim()} onPress={() => void run(() => addAnimalNote(selected.id, eventType, notes.trim()), selected.id)}>
                  <Text style={styles.buttonText}>Save care note</Text>
                </Pressable>
              </View>
              <View style={styles.card}>
                <Text style={styles.section}>Veterinary milestones</Text>
                <Text style={styles.muted}>Record transport and drop-off separately. After confirmed collection, the animal stays in its permanent care record but is off the operational map.</Text>
                {selected.status !== 'AT_VET' ? (
                  <>
                    <KeyboardAwareTextInput style={styles.input} placeholder="Veterinary facility / location *"
                      value={vetLocation} onChangeText={setVetLocation} maxLength={250} />
                    {selected.status !== 'IN_TRANSIT' && collected ? (
                      <Pressable style={styles.button} disabled={busy || !vetLocation.trim()}
                        accessibilityRole="button" onPress={() => void run(
                          () => startVetTransport(selected.id, vetLocation.trim()), selected.id
                        )}>
                        <Text style={styles.buttonText}>Transporting to veterinary clinic</Text>
                      </Pressable>
                    ) : null}
                    <Pressable style={styles.button} disabled={busy || !vetLocation.trim()}
                      accessibilityRole="button" onPress={() => void run(
                        () => recordVetDropoff(selected.id, vetLocation.trim()), selected.id
                      )}>
                      <Text style={styles.buttonText}>Dropped off at veterinary clinic</Text>
                    </Pressable>
                  </>
                ) : selected.vetStage !== 'ASSESSED_AWAITING_TRANSPORT' ? (
                  <Pressable style={styles.button} disabled={busy} accessibilityRole="button"
                    onPress={() => void run(() => recordVetAssessment(selected.id, 'Assessment completed; awaiting transport.'), selected.id)}>
                    <Text style={styles.buttonText}>Assessed · awaiting transport</Text>
                  </Pressable>
                ) : <Text style={styles.muted}>Assessment recorded. Arrange transport or transfer to a carer below.</Text>}
              </View>
              <View style={styles.card}>
                <Text style={styles.section}>{selected.reservedCarerUserId ? 'Deliver to nominated carer' : 'Request custody handover'}</Text>
                <Text style={styles.muted}>The recipient must accept custody before this case leaves your active list.</Text>
                {selected.reservedCarerUserId ? (
                  <Text style={styles.muted}>The carer has already accepted responsibility for future care. Complete an acknowledged custody handover after physical delivery.</Text>
                ) : <View style={styles.chips}>
                  {(['CARE','TRANSPORT'] as const).map(purpose => (
                    <Pressable key={purpose} style={[styles.chip, transferPurpose === purpose && styles.chipSelected]}
                      accessibilityRole="button" onPress={() => setTransferPurpose(purpose)}>
                      <Text style={transferPurpose === purpose ? styles.chipTextSelected : styles.chipText}>
                        {purpose === 'CARE' ? 'Hand to carer' : 'Arrange transport'}
                      </Text>
                    </Pressable>
                  ))}
                </View>}
                <KeyboardAwareTextInput style={styles.input} editable={!selected.reservedCarerUserId}
                  placeholder="Recipient user ID *" autoCapitalize="none" value={recipientId} onChangeText={setRecipientId} />
                <KeyboardAwareTextInput style={styles.input} placeholder="Destination / facility" editable={!selected.reservedCarerUserId}
                  value={destination} onChangeText={setDestination} maxLength={250} />
                <Pressable style={styles.button} disabled={busy || !recipientId.trim()} onPress={() => void run(() => requestAnimalTransfer(selected.id, selected.reservedCarerUserId ?? recipientId.trim(), destination.trim(), '', selected.reservedCarerUserId ? 'CARE' : transferPurpose), selected.id)}>
                  <Text style={styles.buttonText}>Request handover</Text>
                </Pressable>
              </View>
              <View style={styles.card}>
                <Text style={styles.section}>Record final outcome</Text>
                <View style={styles.chips}>
                  {outcomes.map((status) => (
                    <Pressable key={status} style={[styles.chip, outcome === status && styles.chipSelected]} onPress={() => setOutcome(status)}>
                      <Text style={outcome === status ? styles.chipTextSelected : styles.chipText}>{status}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.warning}>Final outcomes close this animal's active care record.</Text>
                <KeyboardAwareTextInput style={styles.input} placeholder="Outcome notes *" multiline value={notes} onChangeText={setNotes} />
                <Pressable style={styles.button} disabled={busy || !notes.trim()} onPress={() => void run(() => recordAnimalOutcome(selected.id, outcome, notes.trim()), selected.id)}>
                  <Text style={styles.buttonText}>Confirm final outcome</Text>
                </Pressable>
              </View>
            </>
          ) : null}
          </> : null}
          {!isCustodian && selected.pendingTransferId && !isFinal ? (
            <View style={styles.card}>
              <Text style={styles.section}>Incoming handover</Text>
              <Text style={styles.muted}>Accept only when you have received the animal and confirmed custody.</Text>
              <Pressable style={styles.button} disabled={busy} onPress={() => void run(() => acceptAnimalTransfer(selected.id), selected.id)}>
                <Text style={styles.buttonText}>Accept custody</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#edf1ee' },
  content: { padding: 20, paddingBottom: 50, gap: 12 },
  modalScrim: { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', padding:20 },
  modalCard: { backgroundColor:'#fff', borderRadius:16, padding:18, gap:14 },
  modalOption: { minHeight:50, borderBottomWidth:1, borderColor:'#d9e1dc', justifyContent:'center', paddingVertical:12 },
  dropdown: { backgroundColor:'#f9fbf9', borderWidth:1, borderColor:'#9caea3', borderRadius:10, minHeight:48, padding:12, justifyContent:'center' },
  dropdownText: { color:'#17211d', fontSize:15, fontWeight:'700' },
  secondaryButton: { borderWidth:1, borderColor:'#9caea3', borderRadius:10, padding:12, alignItems:'center', backgroundColor:'#fff' },
  secondaryButtonText: { color:'#173d2c', fontSize:14, fontWeight:'700' },
  quickPanel: { padding:18, borderRadius:14, borderWidth:2, borderColor:'#98b9a7', backgroundColor:'#fff', gap:12 },
  quickTitle: { color:'#173d2c', fontWeight:'800', fontSize:21, lineHeight:27 },
  success: { color:'#145c3b', fontSize:14, fontWeight:'700', lineHeight:20, paddingVertical:8 },
  advancedToggle: { borderWidth:1, borderColor:'#9caea3', borderRadius:10, padding:15, backgroundColor:'#fff' },
  advancedToggleText: { color:'#173d2c', fontSize:14, fontWeight:'800' },
  heading: { color: '#17211d', fontSize: 26, fontWeight: '800' },
  section: { fontSize: 17, fontWeight: '800', color: '#17211d', marginBottom: 6 },
  bold: { color: '#17211d', fontWeight: '700', fontSize: 15 },
  body: { color: '#435249', marginTop: 6, lineHeight: 20 },
  muted: { color: '#66736c', fontSize: 13, lineHeight: 19 },
  link: { color: '#24583f', fontWeight: '700', paddingVertical: 8 },
  card: { padding: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e1dc', borderRadius: 14, gap: 8 },
  input: { backgroundColor: '#f9fbf9', borderWidth: 1, borderColor: '#d9e1dc', borderRadius: 10, padding: 12, minHeight: 46 },
  multilineInput: { minHeight: 96 },
  fieldLabel: { color: '#17211d', fontWeight: '800', fontSize: 14, marginTop: 5 },
  required: { color: '#a23f35' },
  optional: { color: '#66736c', fontWeight: '500', fontSize: 12 },
  fieldHelp: { color: '#66736c', fontSize: 12, lineHeight: 18 },
  button: { backgroundColor: '#173d2c', borderRadius: 10, padding: 13, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: '#d9e1dc', borderRadius: 9, padding: 8 },
  chipSelected: { backgroundColor: '#173d2c', borderColor: '#173d2c' },
  chipText: { color: '#435249', fontSize: 11, fontWeight: '700' },
  chipTextSelected: { color: '#fff', fontSize: 11, fontWeight: '700' },
  warning: { color: '#875c0c', fontSize: 12, lineHeight: 18 },
  releaseButton: { borderWidth: 1, borderColor: '#a23f35', borderRadius: 10, padding: 13, alignItems: 'center' },
  releaseText: { color: '#a23f35', fontWeight: '800' },
  error: { color: '#a23f35', fontWeight: '700' }
});
