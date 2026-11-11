import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUNTER_DEMO_STORIES, buildHunterDemoStory } from './demo-rescue-stories.ts';
import { readFileSync } from 'node:fs';

const ids = Object.keys(HUNTER_DEMO_STORIES).sort();
const isCompleted = id => Number(id) >= 11 && Number(id) <= 15 ||
  Number(id) >= 36 && Number(id) <= 45;
const rescueFor = (id) => ({
  id: `demo-hunter-rescue-${id}`,
  status: isCompleted(id) ? 'COMPLETED' : 'ASSIGNED',
  assignedUserId: 'demo-hunter-riley-chen',
  type: 'Australian wildlife',
  breed: 'Fictional test animal',
  location: 'Hunter Valley'
});

test('exactly fifteen assigned and fifteen completed demo rescue stories', () => {
  assert.equal(ids.length, 30);
  assert.equal(ids.filter(isCompleted).length, 15);
  assert.equal(ids.filter(id => !isCompleted(id)).length, 15);
  assert.ok(ids.includes('007') && ids.includes('045'));
});

test('deterministic linked animal, call and care events follow each incident timeline', () => {
  for (const id of ids) {
    const story = buildHunterDemoStory(rescueFor(id));
    assert.ok(story, id);
    assert.deepEqual(story, buildHunterDemoStory(rescueFor(id)), `${id} is idempotent`);
    assert.ok(story.pickedUpAt, `${id} has a collection time`);
    assert.equal(story.animal.rescueId, `demo-hunter-rescue-${id}`);
    assert.equal(story.animal.entity, 'animal');
    assert.match(story.animal.id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/i);
    assert.equal(story.animal.demo, true);
    assert.ok(story.events.length >= 3, `${id} has a meaningful history`);
    assert.ok(story.events.some(event => event.type === 'PHONE_UPDATE'), `${id} has phone calls`);
    const times = story.events.map(event => Date.parse(String(event.createdAt)));
    assert.deepEqual(times, [...times].sort((a, b) => a - b), `${id} event order`);
    assert.ok(times.every(t => t >= Date.parse(story.createdAt) && t <= Date.parse(story.updatedAt)));
    assert.ok(Date.parse(story.updatedAt) <= Date.parse('2026-11-11T23:59:59Z'));
    assert.ok(story.events.every(event => event.animalId === story.animal.id));
    assert.ok(story.events.every(event => event.organisationId === 'native-animal-trust-fund'));
    assert.ok(story.events.every(event => event.demo === true));
    assert.equal(new Set(story.events.map(event => event.sk)).size, story.events.length);
    assert.equal(story.animal.version, 1 + HUNTER_DEMO_STORIES[id].beats.length);
  }
});

test('completed case status, final outcome and veterinary notes are coherent', () => {
  const endings = new Set();
  for (const id of ids) {
    const story = buildHunterDemoStory(rescueFor(id));
    assert.ok(story);
    const outcomes = story.events.filter(event => event.type === 'FINAL_OUTCOME');
    if (isCompleted(id)) {
      assert.equal(outcomes.length, 1, id);
      assert.equal(outcomes[0].outcome, story.animal.status);
      assert.ok(['RELEASED', 'DECEASED', 'EUTHANISED'].includes(String(story.animal.status)));
      endings.add(story.animal.status);
    } else {
      assert.equal(outcomes.length, 0, id);
      assert.ok(['IN_RESCUE', 'IN_TRANSIT', 'AT_VET', 'IN_CARE'].includes(String(story.animal.status)));
    }
    const calls = story.events.filter(event => event.type === 'PHONE_UPDATE');
    assert.ok(calls.every(call => typeof call.callerName === 'string' && call.callerName.length > 0));
    assert.ok(calls.every(call => typeof call.notes === 'string' && call.notes.length > 20));
    assert.ok(calls.every(call => call.callbackPermitted === false && call.requestTransport === false));
    assert.ok(calls.every(call => !('callbackPhone' in call)));
  }
  assert.deepEqual([...endings].sort(), ['DECEASED', 'EUTHANISED', 'RELEASED']);
  const last = buildHunterDemoStory(rescueFor('045'));
  assert.equal(last?.events.filter(event => event.finalOutcome === 'EUTHANISED').length, 1);
  assert.equal(last?.events.filter(event => event.type === 'FINAL_OUTCOME').length, 1);
});

test('no stories are generated for real rescue IDs or pending demo jobs', () => {
  assert.equal(buildHunterDemoStory({ ...rescueFor('011'), id:'real-rescue-123' }), null);
  assert.equal(buildHunterDemoStory({ ...rescueFor('001'), status:'PENDING', assignedUserId:'' }), null);
});

test('seed writes only animal histories in demo stage', () => {
  const seed = readFileSync(new URL('../infra/demo.ts', import.meta.url), 'utf8');
  assert.match(seed, /\$app\.stage === "demo" && \(status === "ASSIGNED" \|\| status === "COMPLETED"\)/);
  assert.match(seed, /put\(`DemoStoryAnimal-\$\{n\}`/);
  assert.match(seed, /put\(`DemoStoryEvent-\$\{n\}-/);
});
