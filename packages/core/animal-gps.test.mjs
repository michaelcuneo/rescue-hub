import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAnimalGpsPosition, isActiveAnimalForGps } from './animal-gps.ts';

test('validates and rounds real GPS checkpoints and allows all custody journey phases', () => {
  const phases = ['PICKUP','IN_TRANSIT','VET_ARRIVAL','CARER_HANDOVER','IN_CARE','RELEASE_SITE','CHECKPOINT'];
  for (const phase of phases) {
    assert.deepEqual(validateAnimalGpsPosition({
      latitude: -32.92845629, longitude: 151.77551133, phase, accuracy: 7.9
    }), { latitude: -32.928456, longitude: 151.775511, phase, accuracy: 8 });
  }
});

test('rejects impossible or ambiguous GPS, invalid phase and excessive inaccuracies', () => {
  for (const [latitude, longitude, phase, accuracy] of [
    [0,0,'PICKUP',10], [91,151,'PICKUP',10], [-33,181,'PICKUP',10],
    [Number.NaN,151,'CHECKPOINT',10], [-33,Infinity,'CHECKPOINT',10],
    [-33,151,'FICTITIOUS',10], [-33,151,'CHECKPOINT',-1], [-33,151,'CHECKPOINT',6000]
  ]) {
    assert.throws(() => validateAnimalGpsPosition({ latitude, longitude, phase, accuracy }));
  }
});

test('final animal outcomes never accept new mobile journey positions', () => {
  for (const phase of ['IN_RESCUE','IN_TRANSIT','AT_VET','IN_CARE']) assert.equal(isActiveAnimalForGps(phase), true);
  for (const phase of ['RELEASED','EUTHANISED','DECEASED','VOIDED']) assert.equal(isActiveAnimalForGps(phase), false);
});
