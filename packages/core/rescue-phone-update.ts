/**
 * Telephone updates describe what a caller said, not a confirmed field observation.
 * Keep this validation free of SST/Dynamo dependencies for unit tests.
 */
export const CALLER_ROLES = ['REPORTER', 'RESCUER', 'CARER', 'VET', 'OTHER'] as const;
export type CallerRole = (typeof CALLER_ROLES)[number];

export type PhoneUpdateInput = {
  callerName?: unknown;
  callerRole?: unknown;
  notes?: unknown;
  callbackPermitted?: unknown;
  callbackPhone?: unknown;
  animalId?: unknown;
  requestTransport?: unknown;
  pickupLocation?: unknown;
  pickupLatitude?: unknown;
  pickupLongitude?: unknown;
};

export type ValidPhoneUpdate = {
  callerName: string;
  callerRole: CallerRole;
  notes: string;
  callbackPermitted: boolean;
  callbackPhone?: string;
  animalId?: string;
  requestTransport: boolean;
  pickupLocation?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
};

export function validatePhoneUpdate(input: PhoneUpdateInput): ValidPhoneUpdate {
  if (typeof input.callerName !== 'string' || typeof input.notes !== 'string') {
    throw new Error('Caller name and the information they provided are required.');
  }
  const callerName = input.callerName.trim().replace(/\s+/g, ' ');
  const notes = input.notes.trim();
  const callerRole = input.callerRole === undefined ? 'REPORTER' : input.callerRole;
  const callbackPermitted = input.callbackPermitted === true;
  const phone = typeof input.callbackPhone === 'string' ? input.callbackPhone.trim() : '';
  const animalId = typeof input.animalId === 'string' ? input.animalId.trim() : '';
  const requestTransport = input.requestTransport === true;
  const pickupLocation = typeof input.pickupLocation === 'string' ? input.pickupLocation.trim() : '';
  const pickupLatitude = input.pickupLatitude;
  const pickupLongitude = input.pickupLongitude;
  if (requestTransport && !animalId) throw new Error('Select the animal before requesting a transport volunteer.');
  if (requestTransport && (pickupLocation.length < 5 || pickupLocation.length > 250 ||
      typeof pickupLatitude !== 'number' || !Number.isFinite(pickupLatitude) || pickupLatitude < -90 || pickupLatitude > 90 ||
      typeof pickupLongitude !== 'number' || !Number.isFinite(pickupLongitude) || pickupLongitude < -180 || pickupLongitude > 180)) {
    throw new Error('Select the exact veterinary pickup address on the map search before offering transport.');
  }
  if (animalId && !/^[a-f0-9-]{36}$/i.test(animalId)) throw new Error('Invalid animal ID.');
  if (!callerName || callerName.length > 120) {
    throw new Error('Record who called (maximum 120 characters).');
  }
  if (!notes || notes.length > 4000) {
    throw new Error('Record the telephone update (maximum 4000 characters).');
  }
  if (!CALLER_ROLES.some(role => role === callerRole)) {
    throw new Error('Choose a valid caller role.');
  }
  if (callbackPermitted && (!phone || phone.length > 25 || !/^\+?[0-9][0-9 ()-]{6,24}$/.test(phone))) {
    throw new Error('Enter a valid callback number when the caller permits contact.');
  }
  return {
    callerName, callerRole: callerRole as CallerRole, notes, callbackPermitted, requestTransport,
    ...(animalId ? { animalId } : {}),
    ...(requestTransport ? { pickupLocation, pickupLatitude: pickupLatitude as number, pickupLongitude: pickupLongitude as number } : {}),
    ...(callbackPermitted ? { callbackPhone: phone } : {})
  };
}
