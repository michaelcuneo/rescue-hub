import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCareDestination, canClaimAnimalCare, canTransportForOrganisation } from './care-delivery.ts';

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
test('transport can be claimed by eligible organisation members regardless of species team', () => {
  const base={enabled:true,status:'ACTIVE',roles:['CARER']};
  assert.equal(canTransportForOrganisation(base),true);
  assert.equal(canTransportForOrganisation({...base,roles:[],membershipTypeId:'transport-volunteer'}),true);
  assert.equal(canTransportForOrganisation({...base,roles:['PUBLIC_REPORTER']}),false);
  assert.equal(canTransportForOrganisation({...base,enabled:false}),false);
  assert.equal(canTransportForOrganisation({...base,roles:['DATA_STEWARD']}),false);
});
