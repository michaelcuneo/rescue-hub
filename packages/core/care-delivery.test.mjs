import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCareDestination, canClaimAnimalCare, canTransportForOrganisation, transportCloseStatus } from './care-delivery.ts';

test('carer may request pickup to workplace or opt-in live GPS position', () => {
  assert.deepEqual(validateCareDestination({
    mode: 'WORKPLACE', address: 'Office, Newcastle NSW Australia',
    latitude: -32.93, longitude: 151.75
  }), { mode: 'WORKPLACE', address: 'Office, Newcastle NSW Australia', latitude: -32.93, longitude: 151.75 });
  assert.equal(validateCareDestination({
    mode: 'CURRENT_LOCATION', address: 'My current GPS position',
    latitude: -33.1, longitude: 151.2
  }).mode, 'CURRENT_LOCATION');
});
test('do not allow unverified GPS, missing location or non-finite coordinates', () => {
  const good = { mode:'OTHER', address:'Recipient address NSW', latitude:-32.9,longitude:151.8 };
  for (const bad of [{...good,longitude:NaN},{...good,latitude:91},{...good,mode:'INVALID'},{...good,address:'x'}, {...good,latitude:'-32.9'}]) {
    assert.throws(()=>validateCareDestination(bad));
  }
});
test('care can only be claimed once, when at vet ready for transport', () => {
  assert.equal(canClaimAnimalCare('AT_VET','ASSESSED_AWAITING_TRANSPORT'),true);
  assert.equal(canClaimAnimalCare('AT_VET','AWAITING_ASSESSMENT'),false);
  assert.equal(canClaimAnimalCare('AT_VET','ASSESSED_AWAITING_TRANSPORT','someone'),false);
  assert.equal(canClaimAnimalCare('AT_VET','ASSESSED_AWAITING_TRANSPORT',undefined,'transfer'),false);
  assert.equal(canClaimAnimalCare('IN_CARE','ASSESSED_AWAITING_TRANSPORT'),false);
});
test('transport is independent of carer/rescuer training and requires explicit opt-in', () => {
  const base={enabled:true,status:'ACTIVE',roles:['CARER'], membershipTypeId:'active-rescuer'};
  assert.equal(canTransportForOrganisation(base),false);
  assert.equal(canTransportForOrganisation({...base, canTransport:false}),false);
  assert.equal(canTransportForOrganisation({...base, canTransport:true}),true);
  assert.equal(canTransportForOrganisation({...base, roles:['RESCUER'], canTransport:true}),true);
  assert.equal(canTransportForOrganisation({...base, roles:['DISPATCHER'], canTransport:true}),true);
  assert.equal(canTransportForOrganisation({...base, roles:['ORG_ADMIN'], canTransport:true}),true);
  assert.equal(canTransportForOrganisation({...base, membershipTypeId:'transport-volunteer'}),false);
  assert.equal(canTransportForOrganisation({...base, roles:[], canTransport:true}),true);
  assert.equal(canTransportForOrganisation({...base,roles:['PUBLIC_REPORTER'], canTransport:true}),false);
  assert.equal(canTransportForOrganisation({...base,enabled:false,canTransport:true}),false);
  assert.equal(canTransportForOrganisation({...base,roles:['DATA_STEWARD'],canTransport:true}),true);
});

test('transport closes as completed only after collected animal is accepted by carer', () => {
  assert.equal(transportCloseStatus('ACCEPT_TRANSFER','ASSIGNED','2026-11-11T01:00:00Z'),'COMPLETED');
  assert.equal(transportCloseStatus('ACCEPT_TRANSFER','ASSIGNED'),'CANCELLED');
  assert.equal(transportCloseStatus('ACCEPT_TRANSFER','PENDING'),'CANCELLED');
  assert.equal(transportCloseStatus('OUTCOME','ASSIGNED','2026-11-11T01:00:00Z'),'CANCELLED');
});

test('rescue requires an explicit RESCUER role; old operational memberships have no authority', async () => {
  const { canRescueForOrganisation } = await import('./care-delivery.ts');
  const active = { enabled: true, status: 'ACTIVE', roles: ['RESCUER'] };
  assert.equal(canRescueForOrganisation(active), true);
  assert.equal(canRescueForOrganisation({ ...active, membershipTypeId: undefined }), true);
  assert.equal(canRescueForOrganisation({ ...active, membershipTypeId: 'carer' }), true);
  assert.equal(canRescueForOrganisation({ ...active, roles: ['CARER'], membershipTypeId: 'active-rescuer' }), false);
  assert.equal(canRescueForOrganisation({ ...active, roles: ['ORG_ADMIN'], membershipTypeId: 'active-rescuer' }), false);
  assert.equal(canRescueForOrganisation({ ...active, roles: ['RESCUER', 'CARER'] }), true);
  assert.equal(canRescueForOrganisation({ ...active, roles: [], membershipTypeId: 'active-rescuer' }), false);
  assert.equal(canRescueForOrganisation({ ...active, enabled: false }), false);
  assert.equal(canRescueForOrganisation({ ...active, status: 'INVITED' }), false);
  assert.equal(canRescueForOrganisation({ ...active, roles: ['RESCUER', 'PUBLIC_REPORTER'] }), false);
});
