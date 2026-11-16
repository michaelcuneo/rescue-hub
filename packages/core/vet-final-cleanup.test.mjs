import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vetFinalCleanupKeys } from './vet-final-cleanup.ts';

test('terminal veterinary outcome removes outstanding care offers, carer reservation and private destination', () => {
  const keys = vetFinalCleanupKeys({ id:'animal-one', organisationId:'hwr',reservedCarerUserId:'carer-one' });
  assert.deepEqual(keys, [
    { pk:'ORG#hwr#CARE_OFFERS',sk:'ANIMAL#animal-one' },
    { pk:'USER#carer-one',sk:'CARE_RESERVATION#animal-one' },
    { pk:'ANIMAL#animal-one',sk:'CARE_DELIVERY' }
  ]);
});
test('without an assigned carer only the outstanding offer is cleared', () => {
  assert.deepEqual(vetFinalCleanupKeys({id:'animal-two',organisationId:'hwr'}),[
    {pk:'ORG#hwr#CARE_OFFERS',sk:'ANIMAL#animal-two'}
  ]);
});
