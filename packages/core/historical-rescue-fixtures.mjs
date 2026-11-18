/** Deterministic, fictional regional Rescue Hub history — no AWS side effects. */
const ORG = 'native-animal-trust-fund';
const VOLUNTEERS = [
  'demo-hunter-priya-shah','demo-hunter-jordan-blake',
  'demo-hunter-sam-nguyen','demo-hunter-casey-morgan',
  'demo-hunter-riley-chen','demo-hunter-jamie-foster'
];
const PLACES = [
  ['Newcastle', -32.928, 151.776],
  ['Mayfield', -32.897, 151.736], ['Wallsend', -32.901, 151.672],
  ['New Lambton', -32.929, 151.711], ['Charlestown', -32.969, 151.693],
  ['Merewether', -32.948, 151.755], ['Belmont', -33.031, 151.663],
  ['Swansea', -33.089, 151.632], ['Toronto', -33.013, 151.592],
  ['Warners Bay', -32.975, 151.646], ['Cardiff', -32.939, 151.657],
  ['Morisset', -33.109, 151.487], ['Maitland', -32.732, 151.557],
  ['East Maitland', -32.752, 151.585], ['Kurri Kurri', -32.819, 151.481],
  ['Cessnock', -32.835, 151.357], ['Rutherford', -32.716, 151.535],
  ['Raymond Terrace', -32.759, 151.745], ['Medowie', -32.742, 151.863],
  ['Nelson Bay', -32.723, 152.144], ['Singleton', -32.565, 151.168],
  ['Branxton', -32.656, 151.353], ['Muswellbrook', -32.266, 150.887],
  ['Dungog', -32.403, 151.752], ['Gloucester', -32.011, 151.959],
  ['Tea Gardens', -32.671, 152.163], ['Beresfield', -32.805, 151.649],
  ['Wyee', -33.184, 151.484], ['Scone', -32.051, 150.866],
  ['Paterson', -32.601, 151.616]
];
const SPECIES = [
  ['Magpie','Australian magpie','Grounded after suspected window strike'],
  ['Rainbow lorikeet','Rainbow lorikeet','Possible wing injury after collision'],
  ['Kookaburra','Laughing kookaburra','Entangled in discarded line'],
  ['Tawny frogmouth','Tawny frogmouth','Stunned near roadside'],
  ['Brushtail possum','Common brushtail possum','Animal found injured in backyard'],
  ['Ringtail possum','Common ringtail possum','Orphaned juvenile located'],
  ['Eastern grey kangaroo','Eastern grey kangaroo','Roadside collision reported'],
  ['Blue-tongue lizard','Eastern blue-tongued skink','Garden mesh entanglement'],
  ['Eastern water dragon','Eastern water dragon','Unable to move normally'],
  ['Echidna','Short-beaked echidna','Rescued from roadside drainage'],
  ['Pelican','Australian pelican','Fishing tackle injury'],
  ['Sugar glider','Sugar glider','Displaced from nesting site'],
  ['Wombat','Common wombat','Found beside road with minor injuries'],
  ['Wood duck','Australian wood duck','Separated from family group'],
  ['Flying fox','Grey-headed flying fox','Reported hanging unusually low'],
  ['Diamond python','Diamond python','Found in a residential shed']
];
function random(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 0x100000000;
  };
}
function at(iso, hours) { return new Date(Date.parse(iso) + hours * 3600000).toISOString(); }
function point(lat, lon, rand, distance = 0.02) {
  return {
    latitude: Number((lat + (rand() - .5) * distance).toFixed(6)),
    longitude: Number((lon + (rand() - .5) * distance).toFixed(6))
  };
}
export function buildHistoricalRescueFixtures() {
  const rand = random(20261118);
  const result = [];
  for (let i = 0; i < 200; i++) {
    const number = String(i + 1).padStart(3, '0');
    const id = 'dev-historical-2026-' + number;
    const animalId = 'dev-historical-animal-2026-' + number;
    const eventId = 'dev-historical-outcome-2026-' + number;
    // 200 cases spanning Jan 2024 to Oct 2026, including different days/months.
    const createdAt = at('2024-01-11T01:00:00.000Z', i * 121 + rand() * 18);
    const pickedUpAt = at(createdAt, 3 + rand() * 10);
    const finishedAt = at(pickedUpAt, 24 + rand() * 340);
    const place = PLACES[Math.floor(rand() * PLACES.length)];
    const species = SPECIES[Math.floor(rand() * SPECIES.length)];
    const origin = point(place[1], place[2], rand, 0.055);
    const actor = VOLUNTEERS[i % VOLUNTEERS.length];
    const category = i % 20;
    // 40% relocation, 40% original-site release, 15% euthanasia, 5% death.
    const outcome = category < 8 ? 'RELEASED' : category < 16 ? 'RELEASED' : category < 19 ? 'EUTHANISED' : 'DECEASED';
    const relocation = category < 8;
    const release = relocation ? point(place[1], place[2], rand, 0.12) : origin;
    const reason = relocation ? 'RELOCATION' : 'ORIGINAL_SITE';
    const releaseName = relocation ? 'Synthetic bushland release site near ' + place[0] : 'Original rescue site near ' + place[0];
    const notes = outcome === 'RELEASED'
      ? relocation
        ? 'DEMO ONLY: veterinary clearance documented; relocated to suitable fictional habitat.'
        : 'DEMO ONLY: recovered after care and returned to original rescue location.'
      : outcome === 'EUTHANISED'
        ? 'DEMO ONLY: euthanasia outcome recorded following fictional veterinary assessment.'
        : 'DEMO ONLY: animal died in care following fictional veterinary review.';
    const rescue = {
      pk: 'RESCUE#' + id, sk: 'META', id, entity: 'rescue',
      organisationId: ORG, type: species[0], breed: species[1],
      injury: species[2], location: 'Synthetic rescue near ' + place[0],
      ...origin, status: 'COMPLETED', assignedUserId: actor,
      animalCount: 1, quickAnimalId: animalId,
      pickedUpAt, completedAt: finishedAt, createdAt, updatedAt: finishedAt,
      intakeSource: i % 2 === 0 ? 'PHONE' : 'ONLINE',
      animalStatus: outcome, demo: true, historicalSeed: true,
      gsi1pk: 'STATUS#COMPLETED', gsi1sk: createdAt + '#' + id,
      gsi2pk: 'RESCUES', gsi2sk: createdAt + '#' + id
    };
    const animal = {
      pk: 'ANIMAL#' + animalId, sk: 'META', id: animalId, entity: 'animal',
      rescueId: id, organisationId: ORG, species: species[1],
      description: 'Synthetic historical wildlife care record',
      status: outcome, currentCustodianUserId: actor, version: 3,
      ...(outcome === 'RELEASED' ? {
        releaseLatitude: release.latitude, releaseLongitude: release.longitude,
        releaseLocation: releaseName, currentLocation: releaseName,
        releaseReason: reason, releasedAt: finishedAt
      } : {}),
      createdAt: pickedUpAt, updatedAt: finishedAt,
      demo: true, historicalSeed: true,
      gsi2pk: 'RESCUE_ANIMALS#' + id,
      gsi2sk: pickedUpAt + '#' + animalId
    };
    const event = {
      pk: 'ANIMAL#' + animalId,
      sk: 'EVENT#' + finishedAt + '#' + eventId,
      id: eventId, entity: 'animal_event', type: 'FINAL_OUTCOME',
      animalId, organisationId: ORG, actorUserId: actor, outcome,
      notes, createdAt: finishedAt, originalRescueId: id,
      originalLatitude: origin.latitude, originalLongitude: origin.longitude,
      ...(outcome === 'RELEASED' ? {
        releaseReason: reason, location: releaseName,
        latitude: release.latitude, longitude: release.longitude
      } : {}),
      demo: true, historicalSeed: true
    };
    result.push({ rescue, animal, event });
  }
  return result;
}

