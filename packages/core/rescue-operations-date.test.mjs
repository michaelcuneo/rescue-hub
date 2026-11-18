import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rescueNSWDay,
  rescueTodayNSW,
  shiftRescueDay,
  completedOnNSWDay
} from '../pc-rescues/src/lib/rescue-list.ts';
import { shouldShowOperationsMapPin } from './case-map-visibility.ts';

test('Operations completion date is the completion date, not the original report date', () => {
  const item = {
    status: 'COMPLETED',
    createdAt: '2026-07-13T02:00:00.000Z',
    updatedAt: '2026-11-18T01:30:00.000Z',
    completedAt: '2026-11-18T01:00:00.000Z'
  };
  assert.equal(completedOnNSWDay(item, '2026-11-18'), true);
  assert.equal(completedOnNSWDay(item, '2026-07-13'), false);
  assert.equal(completedOnNSWDay(item, '2026-11-19'), false);
});

test('Older completed case must not reappear in today view after a later update', () => {
  assert.equal(completedOnNSWDay({
    status: 'COMPLETED',
    completedAt: '2026-11-17T04:00:00.000Z',
    updatedAt: '2026-11-18T04:00:00.000Z'
  }, '2026-11-18'), false);
});

test('Legacy completed rows can use updatedAt until completedAt is backfilled', () => {
  assert.equal(completedOnNSWDay({
    status: 'COMPLETED', updatedAt: '2026-11-18T04:00:00.000Z'
  }, '2026-11-18'), true);
  assert.equal(completedOnNSWDay({
    status: 'ASSIGNED', updatedAt: '2026-11-18T04:00:00.000Z'
  }, '2026-11-18'), false);
});

test('NSW calendar dates handle daylight-saving jump and midnight', () => {
  assert.equal(rescueNSWDay('2026-10-03T14:30:00.000Z'), '2026-10-04');
  assert.equal(rescueNSWDay('2026-10-03T16:30:00.000Z'), '2026-10-04');
  assert.equal(rescueTodayNSW(Date.parse('2026-11-18T13:30:00.000Z')), '2026-11-19');
  assert.equal(shiftRescueDay('2026-07-13', 1), '2026-07-14');
  assert.equal(shiftRescueDay('2026-07-13', -1), '2026-07-12');
});

test('Operations MapLibre displays completed rescues for their completion day, even after pickup', () => {
  const completed = {
    status: 'COMPLETED',
    pickedUpAt: '2026-11-17T01:00:00.000Z',
    completedAt: '2026-11-18T01:10:00.000Z',
    updatedAt: '2026-11-18T03:10:00.000Z'
  };
  assert.equal(shouldShowOperationsMapPin(completed, completedOnNSWDay(completed, '2026-11-18')), true);
  assert.equal(shouldShowOperationsMapPin(completed, completedOnNSWDay(completed, '2026-11-19')), false);
});

test('Operations keeps picked-up active jobs hidden, but shows uncollected pending and assigned', () => {
  assert.equal(shouldShowOperationsMapPin({ status: 'PENDING' }, '2026-11-18'), true);
  assert.equal(shouldShowOperationsMapPin({ status: 'ASSIGNED' }, '2026-11-18'), true);
  assert.equal(shouldShowOperationsMapPin({
    status: 'ASSIGNED', pickedUpAt: '2026-11-18T00:00:00.000Z'
  }, '2026-11-18'), false);
  assert.equal(shouldShowOperationsMapPin({ status: 'PENDING', awaitingCarer: true }, '2026-11-18'), false);
  assert.equal(shouldShowOperationsMapPin({ status: 'CANCELLED' }, '2026-11-18'), false);
});
