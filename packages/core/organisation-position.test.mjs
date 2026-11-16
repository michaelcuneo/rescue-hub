import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrganisationPositionName } from './organisation-position.ts';

test('real organisation committee titles are accepted and normalised', () => {
  for (const [name, slug] of [
    ['President', 'president'], ['Secretary', 'secretary'],
    ['Raptor Leader', 'raptor-leader'], ['Reptile Manager', 'reptile-manager'],
    ['Transport Coordinator', 'transport-coordinator']
  ]) {
    assert.deepEqual(validateOrganisationPositionName(name), { name, id: slug });
  }
  assert.equal(validateOrganisationPositionName('  Vice President  ').id, 'vice-president');
});

test('position names reject actual control characters, empty names and lengths > 80', () => {
  for (const input of ['', ' ', 'a'.repeat(81), 'President\nSecretary', 'A\0B', '👋']) {
    assert.throws(() => validateOrganisationPositionName(input));
  }
  assert.equal(validateOrganisationPositionName('a'.repeat(80)).name.length, 80);
});
