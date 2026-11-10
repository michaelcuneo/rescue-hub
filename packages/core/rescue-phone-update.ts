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
};

export type ValidPhoneUpdate = {
  callerName: string;
  callerRole: CallerRole;
  notes: string;
  callbackPermitted: boolean;
  callbackPhone?: string;
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
    callerName, callerRole: callerRole as CallerRole, notes, callbackPermitted,
    ...(callbackPermitted ? { callbackPhone: phone } : {})
  };
}
