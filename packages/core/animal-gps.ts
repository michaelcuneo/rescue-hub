/** GPS checkpoints recorded while an authorised custodian is physically
 * responsible for an animal. No raw background tracking or invented positions. */
export const animalGpsPhases = [
  'PICKUP', 'IN_TRANSIT', 'VET_ARRIVAL', 'CARER_HANDOVER', 'IN_CARE',
  'RELEASE_SITE', 'CHECKPOINT'
] as const;

export type AnimalGpsPhase = (typeof animalGpsPhases)[number];

export type AnimalGpsPosition = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  phase: AnimalGpsPhase;
};

export function validateAnimalGpsPosition(value: Record<string, unknown>): AnimalGpsPosition {
  const latitude = value.latitude;
  const longitude = value.longitude;
  const accuracy = value.accuracy;
  const phase = value.phase;
  if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)) throw new Error('A valid actual GPS position is required.');
  if (!animalGpsPhases.includes(phase as AnimalGpsPhase))
    throw new Error('Unknown animal transport location phase.');
  if (accuracy !== undefined && (typeof accuracy !== 'number' ||
    !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 5000))
    throw new Error('Invalid GPS accuracy.');
  // Round GPS precision to ~11 cm; do not turn free-text addresses into GPS.
  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    phase: phase as AnimalGpsPhase,
    ...(typeof accuracy === 'number' ? { accuracy: Math.round(accuracy) } : {})
  };
}

export function isActiveAnimalForGps(status: string): boolean {
  return status === 'IN_RESCUE' || status === 'IN_TRANSIT' ||
    status === 'AT_VET' || status === 'IN_CARE';
}
