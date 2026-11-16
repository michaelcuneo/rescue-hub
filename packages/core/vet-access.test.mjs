import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canVetAccessAnimal, isVetOnlyUser, validateVetClinic } from './vet-access.ts';

const vet = {
  id: 'vet-1', enabled: true, status: 'ACTIVE', organisationId: 'hwr',
  vetClinicId: 'clinic-a', roles: ['VET_STAFF']
};
const animal = {
  organisationId: 'hwr', vetClinicId: 'clinic-a',
  status: 'AT_VET', physicalCustodianType: 'VET'
};
test('clinic access requires explicit veterinary role, matching registered handover and active custody', () => {
  assert.equal(isVetOnlyUser(vet), true);
  assert.equal(canVetAccessAnimal(vet, animal), true);
  for (const modified of [
    { ...animal, vetClinicId: undefined },
    { ...animal, vetClinicId: 'clinic-b' },
    { ...animal, organisationId: 'another-org' },
    { ...animal, status: 'IN_CARE' },
    { ...animal, status: 'RELEASED' },
    { ...animal, physicalCustodianType: 'RESCUER' }
  ]) assert.equal(canVetAccessAnimal(vet, modified), false);
  for (const modified of [
    { ...vet, enabled: false },
    { ...vet, status: 'INVITED' },
    { ...vet, roles: ['ORG_ADMIN'] },
    { ...vet, roles: ['VET_STAFF','ORG_ADMIN'] },
    { ...vet, vetClinicId: undefined },
    { ...vet, organisationId: 'another-org' }
  ]) assert.equal(canVetAccessAnimal(modified, animal), false);
  assert.equal(canVetAccessAnimal(null, animal), false);
});
test('clinic registration requires a real address and valid coordinates', () => {
  const input = { name: 'Animal Hospital', address: 'Newcastle NSW Australia, Hunter Street',
    latitude: '-32.93', longitude: '151.76' };
  assert.deepEqual(validateVetClinic(input), {
    name: 'Animal Hospital', address: input.address, latitude: -32.93, longitude: 151.76
  });
  for (const bad of [
    { ...input,latitude:'' }, { ...input,latitude:'NaN' },
    { ...input,latitude:91 }, { ...input,longitude:-181 },
    { ...input,name:'' }, { ...input,address:'n/a' }
  ]) assert.throws(() => validateVetClinic(bad));
});
