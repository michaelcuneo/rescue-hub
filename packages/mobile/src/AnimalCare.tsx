import ReporterConversation from './ReporterConversation';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardAwareTextInput } from './KeyboardAware';
import RescueAddress from './RescueAddress';
import {
  acceptAnimalTransfer, addAnimalNote, getAnimalHistory, getRescueAnimals, confirmRescuePickup, getCareDelivery, type CareDeliveryDestination,
  recordAnimalOutcome, registerAnimal, requestAnimalTransfer, startVetTransport, recordVetDropoff, recordVetAssessment, unclaimRescue,
  correctAnimalIdentification, correctReportedRescue, getRescuerReporterContact, quickVetProgress, type Animal, type AnimalEvent, type Rescue
} from './api';

type Props = { rescue: Rescue; userId: string; onBack: () => void; onUnclaim: () => void };
const eventTypes = ['OBSERVATION', 'VET_ASSESSMENT', 'TREATMENT', 'FEEDING', 'WEIGHT', 'REVIEW'] as const;
const outcomes = ['RELEASED', 'EUTHANISED', 'DECEASED'] as const;
const terminal = new Set<string>(outcomes);

export default function AnimalCare({ rescue, userId, onBack, onUnclaim }: Props) {
  const [conversationOpen, setConversationOpen] = useState(false);
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
  const isFinal = selected ? terminal.has(selected.status) : false;

  return (
    <KeyboardAwareScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
      {rescue.status === 'ASSIGNED' && rescue.assignedUserId === userId ? (
        <View style={styles.card}>
          <Text style={styles.section}>Physical collection</Text>
          {collected ? (
            <Text style={styles.muted}>Animal collected. The job pin is now removed from the operational map; the animal's permanent record stays accessible.</Text>
          ) : (
            <>
              <Text style={styles.muted}>Claiming the job did not collect the animal. Confirm only after physically picking up the animal. This removes its pin from the map, not its care record.</Text>
              <KeyboardAwareTextInput style={[styles.input,styles.multilineInput]} value={collectionNotes} onChangeText={setCollectionNotes}
                multiline maxLength={1000} placeholder="Collection notes (optional)" accessibilityLabel="Animal collection notes" />
              <Pressable style={styles.button} disabled={busy} accessibilityRole="button"
                onPress={() => Alert.alert('Confirm physical collection?', 'The animal will disappear from the operational map but remain in your care records.', [
                  { text: 'Not yet', style: 'cancel' },
                  { text: 'Confirm collected', onPress: () => void run(async () => {
                    await confirmRescuePickup(rescue.id, collectionNotes);
                    setCollected(true);
                  }) }
                ])}>
                <Text style={styles.buttonText}>Animal picked up</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}
      {canQuickProgress ? <View style={styles.quickPanel}>
        <Text style={styles.quickTitle}>What happens next?</Text>
        <Text style={styles.muted}>You've collected the animal. Record the next step, without extra forms or user IDs.</Text>
        <Text style={styles.fieldLabel}>Veterinary clinic <Text style={styles.optional}>(needed at drop-off)</Text></Text>
        <KeyboardAwareTextInput style={styles.input} value={vetLocation} onChangeText={setVetLocation}
          maxLength={250} accessibilityLabel="Veterinary clinic" placeholder="e.g. AREC, Broadmeadow" />
        <Text style={styles.fieldLabel}>Notes <Text style={styles.optional}>(optional)</Text></Text>
        <KeyboardAwareTextInput style={styles.input} value={quickVetNotes} onChangeText={setQuickVetNotes}
          multiline maxLength={1000} accessibilityLabel="Optional veterinary handover notes"
          placeholder="e.g. Animal stable, receptionist accepted" />
        {activeAnimal?.status !== 'IN_TRANSIT' ?
          <Pressable style={styles.button} disabled={busy} accessibilityRole="button"
            onPress={() => void saveQuickVet('GOING_TO_VET')}>
            <Text style={styles.buttonText}>Taking to vet</Text>
          </Pressable> : <Text style={styles.warning}>Taking animal to vet — awaiting drop-off</Text>}
        <Pressable style={styles.button} disabled={busy || !vetLocation.trim()}
          accessibilityRole="button" accessibilityState={{disabled:busy || !vetLocation.trim()}}
          onPress={() => Alert.alert('Confirm veterinary handover',
            `Confirm the animal was physically received at ${vetLocation.trim()}? Its care record will remain open.`,
            [{ text:'Not yet', style:'cancel' }, { text:'Handed to vet', onPress:() => void saveQuickVet('HANDED_TO_VET') }])}>
          <Text style={styles.buttonText}>Handed to vet</Text>
        </Pressable>
      </View> : null}
      {activeAnimal?.status === 'AT_VET' ? <View style={styles.quickPanel}>
        <Text style={styles.quickTitle}>At veterinary clinic</Text>
        <Text style={styles.muted}>The clinic has the animal. Its history stays active for veterinary updates and future carer pickup.</Text>
      </View> : null}
      {quickMessage ? <Text style={styles.success}>{quickMessage}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator /> : null}

      {!selected ? (
        <>
          {rescue.assignedUserId === userId && rescue.status === 'ASSIGNED' ? <View style={styles.card}>
            <Text style={styles.section}>Correct the public observation</Text>
            <Text style={styles.muted}>The reporter's original information is retained. Correct what you found at the scene.</Text>
            <KeyboardAwareTextInput style={styles.input} value={incidentSpecies} onChangeText={setIncidentSpecies} maxLength={120} accessibilityLabel="Verified animal identification" placeholder="Confirmed animal" />
            <KeyboardAwareTextInput style={[styles.input,styles.multilineInput]} value={incidentCondition} onChangeText={setIncidentCondition} maxLength={2000} multiline accessibilityLabel="Verified condition" placeholder="Observed injury or condition" />
            <Pressable style={styles.button} disabled={busy || incidentSpecies.trim().length < 2}
              onPress={() => void run(() => correctReportedRescue(rescue.id, incidentSpecies, incidentCondition))}>
              <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Save verified observation'}</Text>
            </Pressable>
          </View> : null}
          <Text style={styles.section}>Animals in this rescue ({animals.length})</Text>
          {animals.map((animal) => (
            <Pressable key={animal.id} style={styles.card} onPress={() => void openAnimal(animal.id)}>
              <Text style={styles.bold}>{animal.species}</Text>
              <Text style={styles.muted}>{animal.status.replace(/_/g, ' ')} · {animal.currentLocation || 'Location not recorded'}</Text>
              <Text style={styles.link}>View care history ›</Text>
            </Pressable>
          ))}
          {animals.length === 0 && !loading ? <Text style={styles.muted}>No animals registered yet.</Text> : null}
          {rescue.assignedUserId === userId && animals.length === 0 && !loading && !collected ? (
            <View style={styles.card}>
              <Text style={styles.section}>Release this rescue</Text>
              <Text style={styles.muted}>Can't attend? Return the case to qualified rescuers. Once an animal is registered, arrange a custody handover instead.</Text>
              <KeyboardAwareTextInput style={styles.input} value={unclaimReason} onChangeText={setUnclaimReason}
                maxLength={500} multiline placeholder="Reason (optional)" />
              <Pressable disabled={busy} style={styles.releaseButton}
                accessibilityRole="button" onPress={() => Alert.alert(
                  'Release rescue claim?',
                  'This rescue will become available for another qualified volunteer.',
                  [{ text:'Keep rescue', style:'cancel' }, { text:'Release claim', style:'destructive', onPress: () => { void releaseClaim(); } }]
                )}>
                <Text style={styles.releaseText}>{busy ? 'Updating…' : 'Release claim'}</Text>
              </Pressable>
            </View>
          ) : null}
          {rescue.assignedUserId === userId && !rescue.transportAnimalId && (
            <View style={styles.card}>
              <Text style={styles.section}>Register an animal</Text>
              <Text style={styles.muted}>Record each animal you collect separately. These details follow the animal through rescue, vet care and handovers.</Text>
              <Text style={styles.fieldLabel}>Animal species / type <Text style={styles.required}>*</Text></Text>
              <KeyboardAwareTextInput
                style={styles.input}
                value={species}
                onChangeText={setSpecies}
                placeholder="e.g. Eastern blue-tongue lizard"
                accessibilityLabel="Animal species or type, required"
                accessibilityHint="The kind of animal you collected. Prefilled from the rescue; edit it if needed."
                autoCapitalize="sentences"
                maxLength={120}
              />
              <Text style={styles.fieldHelp}>Prefilled from the rescue report. Correct it if the animal is a different species.</Text>
              <Text style={styles.fieldLabel}>Identifying details <Text style={styles.optional}>(optional)</Text></Text>
              <KeyboardAwareTextInput
                style={[styles.input, styles.multilineInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Approx. 35 cm, pale blue tail, netting marks on left leg"
                accessibilityLabel="Identifying details, optional"
                accessibilityHint="Size, colour, distinctive markings, condition or injuries that identify this animal."
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />
              <Text style={styles.fieldHelp}>Include approximate size, colours, distinguishing marks or visible injuries.</Text>
              <Pressable style={styles.button} disabled={busy || !species.trim()} onPress={() => void run(async () => {
                await registerAnimal(rescue.id, species.trim(), description.trim());
                setSpecies(rescue.type ?? ''); setDescription('');
              })}>
                <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Register animal'}</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
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
