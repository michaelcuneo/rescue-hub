/** Deterministic synthetic ANIMAL-location milestones for demonstration only.
 * These are fictional street addresses paired with approximate illustrative
 * coordinates, NOT geocoded homes or real clinics. Never use for real users.
 */
export const DEMO_CARER_LOCATIONS = Object.freeze([
  { name: 'Erin Walsh (demo)', address: '14 Paperbark Lane, Toronto NSW 2283 — fictional', latitude: -33.0132, longitude: 151.5888 },
  { name: 'Casey Morgan (demo)', address: '7 Wattlebird Court, Belmont NSW 2280 — fictional', latitude: -33.0324, longitude: 151.6601 },
  { name: 'Priya Shah (demo)', address: '22 Stringybark Grove, Merewether NSW 2291 — fictional', latitude: -32.949, longitude: 151.7509 },
  { name: 'Jamie Foster (demo)', address: '16 Eucalypt Crescent, Cessnock NSW 2325 — fictional', latitude: -32.8373, longitude: 151.3544 },
  { name: 'Riley Chen (demo)', address: '5 Banksia Walk, Cardiff NSW 2285 — fictional', latitude: -32.9401, longitude: 151.654 },
  { name: 'Jordan Blake (demo)', address: '31 Grevillea Way, Maitland NSW 2320 — fictional', latitude: -32.7353, longitude: 151.5597 },
  // A presenter-only, explicitly unverified substitute: NOT a real home GPS.
  { name: 'Presenter (demo)', address: '28 Mitchell St, Stockton NSW 2295 — demo placeholder', latitude: -32.9101, longitude: 151.784 }
]);
export const DEMO_VET_LOCATIONS = Object.freeze([
  { name: 'Fictional Newcastle Wildlife Clinic', address: '3 Currawong Way, Newcastle NSW 2300 — fictional', latitude: -32.932, longitude: 151.764 },
  { name: 'Fictional Lake Macquarie Wildlife Clinic', address: '11 Sandpiper Lane, Charlestown NSW 2290 — fictional', latitude: -32.967, longitude: 151.694 },
  { name: 'Fictional Maitland Wildlife Clinic', address: '29 Bottlebrush Place, East Maitland NSW 2323 — fictional', latitude: -32.752, longitude: 151.584 },
  { name: 'Fictional Hunter Valley Wildlife Clinic', address: '6 Ironbark Walk, Cessnock NSW 2325 — fictional', latitude: -32.833, longitude: 151.357 },
  { name: 'Fictional Port Stephens Wildlife Clinic', address: '8 Coastal Wattle Way, Nelson Bay NSW 2315 — fictional', latitude: -32.725, longitude: 152.143 }
]);
const HOUR = 3_600_000;
const iso = time => new Date(time).toISOString();
const nearest = (places, lat, lon, index) => {
  const distance = place => Math.hypot((place.latitude - lat) * 1.3, place.longitude - lon);
  return [...places].sort((a, b) => distance(a) - distance(b))[index % 2];
};
const round = value => Number(value.toFixed(6));

/** All GPS samples here are synthetic; do not mix them with real tracked data.
 * Only significant events are generated: pickup, vet, care, final release.
 */
export function buildSyntheticAnimalMilestones(rescue, animal, outcomeEvent, ordinal = 0) {
  if (!rescue?.historicalSeed || !animal?.historicalSeed || !outcomeEvent?.historicalSeed)
    throw new Error('Refusing to generate synthetic milestones for a non-demo animal.');
  const start = Date.parse(rescue.pickedUpAt);
  const end = Date.parse(outcomeEvent.createdAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new Error('Demo journey requires pickup and a later final outcome.');
  const span = end - start;
  const origin = { latitude: rescue.latitude, longitude: rescue.longitude };
  const clinic = nearest(DEMO_VET_LOCATIONS, origin.latitude, origin.longitude, ordinal);
  const carer = ordinal % 29 === 0
    ? DEMO_CARER_LOCATIONS.at(-1)
    : nearest(DEMO_CARER_LOCATIONS.slice(0, -1), origin.latitude, origin.longitude, ordinal);
  // Offset the pickup point slightly: this is a *synthetic* map scene, not a
  // claim that a real animal was physically collected at these coordinates.
  const pickup = {
    latitude: round(origin.latitude + .0012),
    longitude: round(origin.longitude - .0007),
    address: 'Fictional confirmed pickup near ' + (rescue.location ?? 'report')
  };
  const milestones = [
    { phase: 'PICKUP', point: pickup, when: start },
    { phase: 'VET_ARRIVAL', point: clinic, when: start + Math.min(span - 1, Math.max(1, Math.round(span * .18))) }
  ];
  const caredFor = outcomeEvent.outcome === 'RELEASED' ||
    (outcomeEvent.outcome === 'DECEASED' && ordinal % 2 === 0);
  if (caredFor) milestones.push({
    phase: 'CARER_HANDOVER', point: carer,
    when: start + Math.min(span - 1, Math.max(2, Math.round(span * .58)))
  });
  if (outcomeEvent.outcome === 'RELEASED') milestones.push({
    phase: 'RELEASE_SITE',
    point: { latitude: outcomeEvent.latitude, longitude: outcomeEvent.longitude,
      address: outcomeEvent.location ?? 'Fictional wildlife release site' },
    when: end
  });
  const checkpoints = milestones.map(({ phase, point, when }) => {
    const at = iso(when);
    const id = 'demo-milestone-' + animal.id + '-' + phase.toLowerCase();
    return {
      pk: 'ANIMAL#' + animal.id,
      sk: 'EVENT#' + at + '#' + id,
      id, entity: 'animal_event', type: 'GPS_CHECKPOINT',
      animalId: animal.id, organisationId: animal.organisationId,
      sourceRescueId: rescue.id, actorUserId: rescue.assignedUserId,
      phase, location: point.address,
      latitude: point.latitude, longitude: point.longitude,
      createdAt: at, demo: true, historicalSeed: true, syntheticJourney: true
    };
  });
  const final = checkpoints.at(-1);
  const projection = {
    animalId: animal.id, latitude: final.latitude, longitude: final.longitude,
    recordedAt: final.createdAt, phase: final.phase, location: final.location
  };
  return { checkpoints, projection };
}
