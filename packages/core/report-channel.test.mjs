import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportChannel, reportChannelLabel } from './report-channel.ts';

test('phone and online are intake channels for one dispatch pipeline', () => {
  assert.equal(reportChannel({ id: 'new-id', intakeSource: 'PHONE' }), 'PHONE');
  assert.equal(reportChannelLabel({ id: 'new-id', intakeSource: 'PHONE' }), 'Phone report');
  assert.equal(reportChannel({ id: 'public-report-report123' }), 'ONLINE');
  assert.equal(reportChannel({ id: 'phone-report-report123' }), 'PHONE');
  assert.equal(reportChannelLabel({ id: 'public-report-report123' }), 'Online report');
});
test('historical rescues without provenance are not falsely called phone reports', () => {
  assert.equal(reportChannel({ id: 'old-unknown' }), 'UNVERIFIED');
  assert.equal(reportChannelLabel({ id: 'old-unknown' }), 'Public report');
});
test('online prefix is authoritative even if stored metadata is stale', () => {
  assert.equal(reportChannel({ id: 'public-report-123', intakeSource: 'PHONE' }), 'ONLINE');
});
