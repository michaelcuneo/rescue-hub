/**
 * Fictional Hunter wildlife rescue histories for the SST demo stage only.
 * Every timestamp, caller, animal and event is deterministic: repeated
 * deployments must not invent new incidents or overwrite non-demo records.
 * No phone numbers, live veterinary services or private care addresses.
 */
export type DemoCaseStatus = 'ASSIGNED' | 'COMPLETED';
export type DemoAnimalStatus =
  'IN_RESCUE' | 'IN_TRANSIT' | 'AT_VET' | 'IN_CARE' | 'RELEASED' | 'EUTHANISED' | 'DECEASED';
type CallerRole = 'REPORTER' | 'RESCUER' | 'CARER' | 'VET';

type Beat = {
  kind: 'EVENT' | 'PHONE'; afterHours: number; type: string; notes: string;
  callerRole?: CallerRole; callerName?: string; actor?: 'RESCUER' | 'CARER' | 'DISPATCHER';
  finalOutcome?: 'EUTHANISED' | 'DECEASED';
};
type Story = {
  startedAt: string;
  status: DemoAnimalStatus;
  pickupAtHours?: number;
  finishedAtHours?: number;
  outcomeNotes?: string;
  carerId?: string;
  location?: string;
  beats: Beat[];
};

const e = (afterHours: number, type: string, notes: string, actor?: Beat['actor']): Beat =>
  ({ kind: 'EVENT', afterHours, type, notes, actor });
const p = (afterHours: number, callerRole: CallerRole, callerName: string, notes: string,
  finalOutcome?: Beat['finalOutcome']): Beat =>
  ({ kind: 'PHONE', afterHours, type: 'PHONE_UPDATE', callerRole, callerName, notes, finalOutcome });

const CLINIC = 'Fictional Hunter wildlife veterinary clinic';
const CARER = 'Licensed wildlife carer (demonstration)';

/** 15 completed and 15 assigned demo cases, matching the pre-existing case IDs. */
export const HUNTER_DEMO_STORIES: Record<string, Story> = {
  '011': {
    startedAt: '2026-10-28T00:00:00Z', status: 'RELEASED', pickupAtHours: 2,
    finishedAtHours: 124,
    outcomeNotes: 'Flight and feeding normal after hook removal and rehabilitation. Released at suitable coastal habitat with approval from the treating wildlife veterinarian.',
    beats: [
      e(3, 'VET_DROPOFF', 'Pelican admitted for removal of fishing tackle and examination.'),
      p(5, 'VET', 'Dr Mira Vale', 'Fishing hook removed under sedation. Minor soft-tissue damage only; antibiotics commenced. Will keep the pelican overnight.'),
      p(23, 'VET', 'Dr Mira Vale', 'Alert and feeding. Observing for three days to monitor wound healing and mobility. No transport clearance yet.'),
      e(52, 'TREATMENT', 'Wound cleaned, antibiotic course continued and normal swimming observed.'),
      p(80, 'CARER', 'Casey Morgan', 'Animal has been swimming and feeding independently. Awaiting final release approval.'),
      p(118, 'VET', 'Dr Mira Vale', 'Recheck satisfactory. Wound healed, flight strong and suitable for release.'),
    ]
  },
  '012': {
    startedAt: '2026-11-04T00:00:00Z', status: 'RELEASED', pickupAtHours: 1,
    finishedAtHours: 4,
    outcomeNotes: 'Fledgling placed back in secure cover close to the original nest. Parents returned and resumed feeding; monitored before closure.',
    beats: [
      e(1.5, 'OBSERVATION', 'Juvenile alert, no obvious injury. Parent magpies calling from a nearby tree.'),
      p(2, 'REPORTER', 'Local resident', 'Parent magpies have returned to the same backyard and are calling to the juvenile.'),
      e(3, 'REVIEW', 'Observed the adults feeding the fledgling from a safe distance. Veterinary intervention not needed.'),
    ]
  },
  '013': {
    startedAt: '2026-10-31T01:00:00Z', status: 'DECEASED', pickupAtHours: 2,
    finishedAtHours: 29,
    outcomeNotes: 'Clinic reported that the possum died overnight despite warming and fluid therapy. Outcome documented and coordinator notified.',
    beats: [
      e(3, 'VET_DROPOFF', 'Adult possum weak after entrapment. Presented for treatment of dehydration and possible internal illness.'),
      p(4, 'VET', 'Dr Hannah Reid', 'Severely dehydrated and hypothermic. Giving fluids and warmth; will keep overnight with close monitoring. Prognosis guarded.'),
      p(21, 'VET', 'Dr Hannah Reid', 'Still unresponsive to supportive care. Continuing observation and comfort measures.'),
      p(29, 'VET', 'Dr Hannah Reid', 'The possum died overnight despite treatment. Time and clinical outcome confirmed with the treating veterinarian.', 'DECEASED'),
    ]
  },
  '014': {
    startedAt: '2026-10-30T02:00:00Z', status: 'RELEASED', pickupAtHours: 1,
    finishedAtHours: 48,
    outcomeNotes: 'Neurological examination normal after observation. Returned to sheltered habitat close to the original rescue location.',
    beats: [
      e(3, 'VET_DROPOFF', 'Tawny frogmouth assessed following suspected glass strike. No obvious fracture.'),
      p(4, 'VET', 'Dr Ewan Bell', 'Bird responsive but concussed. Will keep overnight in a quiet enclosure and reassess balance and vision.'),
      p(25, 'VET', 'Dr Ewan Bell', 'Alert, perching normally and eating; continue observing for a second night before release.'),
      e(37, 'REVIEW', 'Carer documented symmetrical wing movement and appropriate response to handling.'),
    ]
  },
  '015': {
    startedAt: '2026-10-27T01:00:00Z', status: 'RELEASED', pickupAtHours: 1,
    finishedAtHours: 146,
    outcomeNotes: 'Tail wound fully closed and animal moving normally. Cleared for release to suitable protected habitat.',
    beats: [
      e(4, 'VET_DROPOFF', 'Water dragon presented for assessment of a tail laceration.'),
      p(6, 'VET', 'Dr Leila Stone', 'Performed minor surgery to clean and close the tail wound. No major tissue damage. Will keep overnight.'),
      p(31, 'VET', 'Dr Leila Stone', 'Post-operative check satisfactory. Observing for three days; no transport until wound stable.'),
      e(78, 'TREATMENT', 'Dressing checked, appetite normal and no signs of infection.'),
      p(121, 'CARER', 'Riley Chen', 'Animal active and feeding normally. Vet has requested one final wound review.'),
    ]
  },
  '036': {
    startedAt: '2026-11-05T00:00:00Z', status: 'RELEASED', pickupAtHours: 1,
    finishedAtHours: 5,
    outcomeNotes: 'Fledgling reunited with family group after observation confirmed parental feeding. Closed as a successful reunification.',
    beats: [
      e(1.5, 'OBSERVATION', 'Animal alert, feathered and mobile. No injuries on visual assessment.'),
      p(2, 'RESCUER', 'Priya Shah', 'Parents are close by. Holding back to allow them to approach; no vet transport indicated.'),
      e(4, 'REVIEW', 'Both parents observed feeding the juvenile at the original site.'),
    ]
  },
  '037': {
    startedAt: '2026-10-24T00:00:00Z', status: 'RELEASED', pickupAtHours: 2,
    finishedAtHours: 192,
    carerId: 'demo-hunter-erin-walsh',
    outcomeNotes: 'Following rehabilitation and a final fitness check, possum released into an appropriate safe area near where it was found.',
    beats: [
      e(4, 'VET_DROPOFF', 'Possum given fluids and examined for possible minor soft-tissue injuries.'),
      p(6, 'VET', 'Dr Hannah Reid', 'Stable after fluids. Will keep overnight for observation before deciding on a licensed carer placement.'),
      p(27, 'VET', 'Dr Hannah Reid', 'Discharge to a licensed wildlife carer approved; continue observing and feeding for several days.'),
      e(33, 'TRANSFER_ACCEPTED', 'Erin Walsh accepted custody for short-term rehabilitation.', 'CARER'),
      p(98, 'CARER', 'Erin Walsh', 'Appetite and mobility improving. Continuing observation and recording weights.'),
      e(151, 'REVIEW', 'Climbing, feeding and moving normally. Release assessment requested.', 'CARER'),
    ]
  },
  '038': {
    startedAt: '2026-10-25T01:00:00Z', status: 'RELEASED', pickupAtHours: 2,
    finishedAtHours: 169,
    outcomeNotes: 'Minor wing repair healed. Flight assessment passed and lorikeet returned to a suitable release site.',
    beats: [
      e(4, 'VET_DROPOFF', 'Lorikeet admitted for wing injury review.'),
      p(5, 'VET', 'Dr Mira Vale', 'Performed minor surgery to repair a superficial wing laceration. Keeping overnight for pain relief and observation.'),
      p(30, 'VET', 'Dr Mira Vale', 'Stable after surgery. Observing for three days before considering rehabilitation flight testing.'),
      e(86, 'TREATMENT', 'Wound inspected and wing range of motion assessed; recovering as expected.'),
      p(141, 'RESCUER', 'Sam Nguyen', 'Bird flying strongly in the rehabilitation enclosure; awaiting final veterinary clearance.'),
    ]
  },
  '039': {
    startedAt: '2026-11-02T00:00:00Z', status: 'RELEASED', pickupAtHours: 1,
    finishedAtHours: 30,
    outcomeNotes: 'Animal passed physical examination and was safely released to sheltered creek-side habitat.',
    beats: [
      e(2, 'VET_DROPOFF', 'Water dragon checked for internal injury following dog encounter.'),
      p(3, 'VET', 'Dr Leila Stone', 'No fractures or punctures found. Will keep overnight to observe mobility and appetite.'),
      p(25, 'VET', 'Dr Leila Stone', 'Clinically well and fit for release. Return to suitable habitat away from dogs and road traffic.'),
    ]
  },
  '040': {
    startedAt: '2026-11-03T00:00:00Z', status: 'RELEASED', pickupAtHours: 1,
    finishedAtHours: 4,
    outcomeNotes: 'Echidna assessed as uninjured and moved safely to nearby habitat away from the road.',
    beats: [
      e(1.5, 'OBSERVATION', 'Alert, active and without visible injuries. Vehicle movement controlled at the scene.'),
      p(2, 'RESCUER', 'Jamie Foster', 'Echidna is moving normally. Identified a safer nearby release point away from the carriageway.'),
      e(3, 'REVIEW', 'Confirmed animal moved clear of the hazard and remained active.'),
    ]
  },
  '041': {
    startedAt: '2026-10-23T00:00:00Z', status: 'RELEASED', pickupAtHours: 2,
    finishedAtHours: 192,
    carerId: 'demo-hunter-erin-walsh',
    outcomeNotes: 'After a period of quiet rehabilitation and flight assessment, frogmouth cleared and released at dusk.',
    beats: [
      e(4, 'VET_DROPOFF', 'Frogmouth admitted for concussion assessment.'),
      p(5, 'VET', 'Dr Ewan Bell', 'No fracture seen; likely concussion. Will keep overnight and review neurological signs.'),
      p(30, 'VET', 'Dr Ewan Bell', 'Stable but unsteady in flight. Recommend three days of observation followed by controlled flight testing.'),
      e(49, 'TRANSFER_ACCEPTED', 'Licensed carer Erin Walsh acknowledged transfer and began rehabilitation.', 'CARER'),
      p(113, 'CARER', 'Erin Walsh', 'Bird is perching and eating normally, flight still improving.'),
      e(165, 'REVIEW', 'Flight and landing checks satisfactory. Cleared for dusk release.', 'CARER'),
    ]
  },
  '042': {
    startedAt: '2026-09-02T00:00:00Z', status: 'RELEASED', pickupAtHours: 1,
    finishedAtHours: 1480,
    carerId: 'demo-hunter-erin-walsh',
    outcomeNotes: 'Joey completed specialist rehabilitation and staged return to independent feeding; released with qualified wildlife carers supervising.',
    beats: [
      e(3, 'VET_DROPOFF', 'Juvenile kangaroo examined after separation from family group.'),
      p(5, 'VET', 'Dr Hannah Reid', 'No acute fractures. Warmth, hydration and specialist macropod care required; keeping overnight.'),
      e(30, 'TRANSFER_ACCEPTED', 'Transferred to specialist carer for long-term rehabilitation.', 'CARER'),
      p(110, 'CARER', 'Erin Walsh', 'Joey feeding with assistance, gradually increasing activity. Monitoring weight and hydration.'),
      e(420, 'WEIGHT', 'Growth tracking within expected range; progressing toward independent feeding.', 'CARER'),
      p(995, 'CARER', 'Erin Walsh', 'Moving independently in a suitable outdoor enclosure. Behaviour normal; preparing for supervised release.'),
      e(1460, 'REVIEW', 'Specialist rehabilitation and release readiness review completed.', 'CARER'),
    ]
  },
  '043': {
    startedAt: '2026-11-06T00:00:00Z', status: 'RELEASED', pickupAtHours: 1,
    finishedAtHours: 6,
    outcomeNotes: 'Line removed without injury. After a short observation period the kookaburra flew strongly and was released.',
    beats: [
      e(2, 'OBSERVATION', 'Fishing line carefully removed from the leg; no significant swelling or open wound.'),
      p(3, 'RESCUER', 'Sam Nguyen', 'Bird is weight bearing and alert. Holding for brief observation before release.'),
      e(5, 'REVIEW', 'Normal grip, perching and short flight confirmed.'),
    ]
  },
  '044': {
    startedAt: '2026-09-19T00:00:00Z', status: 'RELEASED', pickupAtHours: 2,
    finishedAtHours: 1100,
    carerId: 'demo-hunter-casey-morgan',
    outcomeNotes: 'Orphaned juvenile ringtail possum weaned and rehabilitated successfully, then released into suitable habitat.',
    beats: [
      e(3, 'VET_DROPOFF', 'Orphaned juvenile checked for injury and dehydration.'),
      p(5, 'VET', 'Dr Leila Stone', 'Stable but too young for release. Will keep overnight before transferring to a licensed carer.'),
      e(30, 'TRANSFER_ACCEPTED', 'Casey Morgan accepted custody for hand-rearing and rehabilitation.', 'CARER'),
      p(145, 'CARER', 'Casey Morgan', 'Taking feeds regularly; monitoring weight and hydration each day.'),
      e(540, 'WEIGHT', 'Weight and growth progressing. Transitioning to independent feeding.', 'CARER'),
      p(1060, 'CARER', 'Casey Morgan', 'Ready for supervised release after a successful soft-release acclimatisation period.'),
    ]
  },
  '045': {
    startedAt: '2026-11-04T00:00:00Z', status: 'EUTHANISED', pickupAtHours: 2,
    finishedAtHours: 51,
    outcomeNotes: 'Treating veterinarian confirmed euthanasia on welfare grounds following extensive internal damage and unsuccessful supportive care.',
    beats: [
      e(3, 'VET_DROPOFF', 'Pelican transported for examination following fishing hook removal; additional injury suspected.'),
      p(5, 'VET', 'Dr Mira Vale', 'Assessment shows significant deeper injuries from fishing tackle. Commenced pain relief and supportive care; will keep overnight.'),
      p(29, 'VET', 'Dr Mira Vale', 'Condition has deteriorated. Further imaging suggests extensive injury; continuing pain relief while prognosis is assessed.'),
      p(51, 'VET', 'Dr Mira Vale', 'Injuries too substantial for humane recovery. Euthanasia performed by the treating veterinarian; coordinator informed.', 'EUTHANISED'),
    ]
  },

  '006': {
    startedAt: '2026-11-10T00:00:00Z', status: 'IN_RESCUE', pickupAtHours: 1,
    location: 'Rescue vehicle — Charlestown',
    beats: [
      e(1.5, 'OBSERVATION', 'Kookaburra collected; fishing line visible around one leg, responsive and vocalising.'),
      p(2, 'RESCUER', 'Sam Nguyen', 'Picked up the kookaburra. Keeping it secure and arranging veterinary assessment of the leg.'),
    ]
  },
  '007': {
    startedAt: '2026-11-09T00:00:00Z', status: 'AT_VET', pickupAtHours: 1,
    location: CLINIC,
    beats: [
      e(3, 'VET_DROPOFF', 'Flying fox handed over by authorised and vaccinated handler for wing assessment.'),
      p(4, 'VET', 'Dr Ewan Bell', 'Suspected soft-tissue wing injury; no obvious fracture. Will keep overnight under specialist observation.'),
      p(24, 'VET', 'Dr Ewan Bell', 'Wing movement improving. Observing for three days; no release or transport clearance yet.'),
    ]
  },
  '008': {
    startedAt: '2026-11-10T01:00:00Z', status: 'IN_TRANSIT', pickupAtHours: 1,
    location: 'In transit to veterinary assessment',
    beats: [
      e(1.5, 'OBSERVATION', 'Kangaroo found conscious with restricted hind-limb movement. Area made safe and joey check planned.'),
      e(2, 'VET_TRANSPORT_STARTED', 'Rescuer commenced urgent transfer for veterinary assessment.'),
      p(3, 'RESCUER', 'Jamie Foster', 'Animal secured for transport. Vet has been advised of possible limb and pelvic injury.'),
    ]
  },
  '009': {
    startedAt: '2026-11-09T02:00:00Z', status: 'AT_VET', pickupAtHours: 1,
    location: CLINIC,
    beats: [
      e(2.5, 'VET_DROPOFF', 'Possum admitted following cat attack; puncture wounds assessed.'),
      p(4, 'VET', 'Dr Hannah Reid', 'Wounds cleaned and antibiotic treatment started. Will keep overnight and monitor for infection.'),
      p(26, 'VET', 'Dr Hannah Reid', 'Stable but treatment continues. Observing for three days before considering carer handover.'),
    ]
  },
  '010': {
    startedAt: '2026-11-10T00:30:00Z', status: 'IN_RESCUE', pickupAtHours: 0.75,
    location: 'Rescue site — East Maitland',
    beats: [
      e(1, 'OBSERVATION', 'Roadside hazard assessed. Echidna safely collected from low roadside vegetation.'),
      p(2, 'RESCUER', 'Jordan Blake', 'Animal safely in a quiet carrier. Assessing for injury before moving it away from traffic.'),
    ]
  },
  '026': {
    startedAt: '2026-11-09T00:00:00Z', status: 'AT_VET', pickupAtHours: 1,
    location: CLINIC,
    beats: [
      e(2, 'VET_DROPOFF', 'Grey-headed flying fox collected by a specialist and presented for assessment.'),
      p(4, 'VET', 'Dr Ewan Bell', 'Netting removed and wing examined. Will keep overnight and observe mobility. Specialist handling only.'),
    ]
  },
  '027': {
    startedAt: '2026-11-10T00:00:00Z', status: 'AT_VET', pickupAtHours: 1,
    location: CLINIC,
    beats: [
      e(2, 'VET_DROPOFF', 'Rainbow lorikeet admitted for wing injury examination.'),
      p(4, 'VET', 'Dr Mira Vale', 'Small wing laceration identified. Minor surgery scheduled; bird will remain overnight for pain control and monitoring.'),
    ]
  },
  '028': {
    startedAt: '2026-11-10T00:00:00Z', status: 'IN_TRANSIT', pickupAtHours: 1,
    location: 'In transit to wildlife veterinary assessment',
    beats: [
      e(2, 'VET_TRANSPORT_STARTED', 'Kangaroo collected; joey reported but not yet confirmed. Transferring for veterinary assessment.'),
      p(3, 'RESCUER', 'Jordan Blake', 'Adult stabilised for transport. Vet notified of potential pouch young and possible impact injuries.'),
    ]
  },
  '029': {
    startedAt: '2026-11-10T00:00:00Z', status: 'IN_RESCUE', pickupAtHours: 1,
    location: 'Rescue vehicle — Cardiff',
    beats: [
      e(1.5, 'OBSERVATION', 'Skink freed from fencing, minor abrasions noted; warm and responsive.'),
      p(2, 'RESCUER', 'Riley Chen', 'Animal has been collected. Cleaning superficial wounds and arranging a veterinary check before release.'),
    ]
  },
  '030': {
    startedAt: '2026-11-09T00:00:00Z', status: 'IN_CARE', pickupAtHours: 1,
    location: CARER,
    beats: [
      e(2, 'OBSERVATION', 'Possum removed from roof cavity; mildly dehydrated but moving normally.'),
      e(5, 'TRANSFER_ACCEPTED', 'Casey Morgan accepted custody for short-term care and rehydration.', 'CARER'),
      p(27, 'CARER', 'Casey Morgan', 'Feeding normally. Keeping under observation for another night before release assessment.'),
    ]
  },
  '031': {
    startedAt: '2026-11-09T01:00:00Z', status: 'AT_VET', pickupAtHours: 1,
    location: CLINIC,
    beats: [
      e(3, 'VET_DROPOFF', 'Kookaburra presented for suspected leg fracture.'),
      p(6, 'VET', 'Dr Leila Stone', 'X-ray confirms minor fracture; immobilised and provided pain relief. Will keep overnight and assess next steps.'),
    ]
  },
  '032': {
    startedAt: '2026-11-10T00:00:00Z', status: 'IN_RESCUE', pickupAtHours: 1,
    location: 'Secure temporary care — Maitland',
    beats: [
      e(2, 'OBSERVATION', 'Duckling found alone and warmed in a quiet ventilated carrier.'),
      p(3, 'RESCUER', 'Jamie Foster', 'No obvious injury. Searching for family group; if reunion fails, will consult a licensed waterbird carer.'),
    ]
  },
  '033': {
    startedAt: '2026-11-09T00:00:00Z', status: 'IN_CARE', pickupAtHours: 1,
    location: CARER,
    beats: [
      e(2, 'OBSERVATION', 'Glider secured after being found in a garage; alert but underweight.'),
      e(4, 'TRANSFER_ACCEPTED', 'Casey Morgan accepted custody for hydration and feeding support.', 'CARER'),
      p(26, 'CARER', 'Casey Morgan', 'Taking food in small amounts. Will observe for three days and monitor weight before any release decision.'),
    ]
  },
  '034': {
    startedAt: '2026-11-09T00:00:00Z', status: 'AT_VET', pickupAtHours: 1,
    location: CLINIC,
    beats: [
      e(2, 'VET_DROPOFF', 'Cockatoo admitted with suspected beak trauma.'),
      p(4, 'VET', 'Dr Mira Vale', 'Beak damage assessed. Pain relief administered; minor repair may be necessary. Keeping overnight for feeding observation.'),
    ]
  },
  '035': {
    startedAt: '2026-11-10T01:00:00Z', status: 'IN_RESCUE', pickupAtHours: 0.75,
    location: 'Rescue site — Edgeworth',
    beats: [
      e(1, 'OBSERVATION', 'Turtle safely collected from the road. Initial shell check shows no obvious damage.'),
      p(2, 'RESCUER', 'Riley Chen', 'Turtle secure after pickup; reviewing movement and shell condition before deciding on a veterinary visit.'),
    ]
  }
};

export type DemoStoryCase = {
  id: string; status: DemoCaseStatus; type: string; breed: string;
  location: string; assignedUserId: string;
};
export type DemoStoryItem = { [key: string]: string | number | boolean };
export type DemoBuiltStory = {
  createdAt: string; updatedAt: string; pickedUpAt?: string;
  animal: DemoStoryItem; events: DemoStoryItem[];
};

const HUNTER_ORG = 'native-animal-trust-fund';
const DISPATCHER_ID = 'demo-hunter-alex-mercer';
const isoAt = (start: string, hours: number) =>
  new Date(Date.parse(start) + hours * 3_600_000).toISOString();
const stableUuid = (prefix: 'a' | 'b', incidentNumber: string, ordinal = 0) =>
  `${prefix === 'a' ? 'a0a0a0a0' : 'b0b0b0b0'}-0000-4000-8000-${String(Number(incidentNumber) * 100 + ordinal).padStart(12, '0')}`;

export function buildHunterDemoStory(rescue: DemoStoryCase): DemoBuiltStory | null {
  const number = rescue.id.replace('demo-hunter-rescue-', '');
  const story = HUNTER_DEMO_STORIES[number];
  if (!story) return null;

  if (!rescue.assignedUserId || !['ASSIGNED', 'COMPLETED'].includes(rescue.status))
    throw new Error(`Demo story ${number} must belong to an assigned/completed rescue.`);
  const isFinal = ['RELEASED', 'EUTHANISED', 'DECEASED'].includes(story.status);
  if (isFinal !== (rescue.status === 'COMPLETED'))
    throw new Error(`Demo story ${number} has a non-matching lifecycle status.`);
  if (isFinal && (story.finishedAtHours === undefined || !story.outcomeNotes))
    throw new Error(`Demo story ${number} needs a documented final outcome.`);
  if (story.beats.some(beat =>
    beat.afterHours < 0 || (isFinal && beat.afterHours > story.finishedAtHours!)))
    throw new Error(`Demo story ${number} contains an out-of-order event.`);

  const animalId = stableUuid('a', number);
  const createdAt = isoAt(story.startedAt, 0);
  const animalCreatedAt = isoAt(story.startedAt, story.pickupAtHours ?? 1);
  const pickedUpAt = story.pickupAtHours === undefined ? undefined :
    isoAt(story.startedAt, story.pickupAtHours);
  const finalHour = story.finishedAtHours;
  const lastHour = Math.max(0, ...story.beats.map(beat => beat.afterHours), finalHour ?? 0);
  const updatedAt = isoAt(story.startedAt, lastHour);
  const custodianId = story.carerId ?? rescue.assignedUserId;

  const location = story.location ??
    (isFinal
      ? story.status === 'RELEASED'
        ? `Released — ${rescue.location}`
        : CLINIC
      : story.status === 'AT_VET' ? CLINIC : `Rescue site — ${rescue.location}`);

  const animal: DemoStoryItem = {
    pk: `ANIMAL#${animalId}`, sk: 'META', entity: 'animal',
    id: animalId, rescueId: rescue.id, organisationId: HUNTER_ORG,
    species: rescue.breed || rescue.type,
    description: `Fictional ${rescue.type.toLowerCase()} record — ${rescue.location}. Source report: ${rescue.breed}.`,
    status: story.status, currentCustodianUserId: custodianId,
    currentLocation: location, version: 1 + story.beats.length,
    createdAt: animalCreatedAt, updatedAt,
    gsi2pk: `RESCUE_ANIMALS#${rescue.id}`, gsi2sk: `${animalCreatedAt}#${animalId}`,
    gsi1pk: `CUSTODIAN#${HUNTER_ORG}#${custodianId}`,
    gsi1sk: `${animalCreatedAt}#${animalId}`,
    demo: true
  };
  if (story.status === 'AT_VET') animal.vetStage = 'AWAITING_ASSESSMENT';

  const baseEvent = (ordinal: number, at: string, type: string, notes: string,
    actorUserId: string): DemoStoryItem => ({
      pk: `ANIMAL#${animalId}`, sk: `EVENT#${at}#${stableUuid('b', number, ordinal)}`,
      id: stableUuid('b', number, ordinal), entity: 'animal_event', animalId,
      organisationId: HUNTER_ORG, type, notes, actorUserId,
      createdAt: at, occurredAt: at, demo: true
    });

  let ordinal = 1;
  const events: DemoStoryItem[] = [
    { ...baseEvent(ordinal++, animalCreatedAt, 'ANIMAL_REGISTERED',
      'Animal registered in Rescue Hub by the assigned responder.', rescue.assignedUserId),
      source: 'DIRECT' }
  ];

  for (const beat of story.beats) {
    const at = isoAt(story.startedAt, beat.afterHours);
    if (beat.kind === 'PHONE') {
      events.push({
        ...baseEvent(ordinal++, at, 'PHONE_UPDATE', beat.notes, DISPATCHER_ID),
        source: 'PHONE', callerName: beat.callerName!, callerRole: beat.callerRole!,
        callbackPermitted: false, requestTransport: false,
        ...(beat.finalOutcome ? { finalOutcome: beat.finalOutcome } : {})
      });
    } else {
      const actorUserId = beat.actor === 'DISPATCHER' ? DISPATCHER_ID :
        beat.actor === 'CARER' ? custodianId : rescue.assignedUserId;
      events.push({ ...baseEvent(ordinal++, at, beat.type, beat.notes, actorUserId),
        source: 'DIRECT' });
    }
  }

  if (isFinal && finalHour !== undefined && story.outcomeNotes) {
    const isVetOutcome = story.status === 'EUTHANISED' || story.status === 'DECEASED';
    events.push({
      ...baseEvent(ordinal++, isoAt(story.startedAt, finalHour), 'FINAL_OUTCOME',
        story.outcomeNotes, isVetOutcome ? DISPATCHER_ID : custodianId),
      outcome: story.status, source: isVetOutcome ? 'PHONE' : 'DIRECT',
      ...(isVetOutcome ? { reportedByName: 'Treating veterinarian' } : {})
    });
  }

  return { createdAt, updatedAt, pickedUpAt, animal,
    events: events.sort((a, b) => String(a.sk).localeCompare(String(b.sk))) };
}
