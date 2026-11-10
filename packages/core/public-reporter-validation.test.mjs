import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidReporterEmail, isValidReporterVerificationCode, normalizeReporterName } from './public-reporter-validation.ts';

test('accepts a standard Gmail account and common valid email forms', () => {
  for (const email of [
    'michaelcuneo75@gmail.com',
    'wildlife.reporter+rescue@gmail.com',
    'member@example.com.au',
    'abc.def@example.org'
  ]) {
    assert.equal(isValidReporterEmail(email), true, email);
  }
});
test('rejects malformed and oversized emails', () => {
  for (const email of ['not-an-email', 'missing@domain', '@example.org', 'name @example.org', 'name@example .org', '', 'x'.repeat(250) + '@example.org']) {
    assert.equal(isValidReporterEmail(email), false, email);
  }
});
test('accepts exactly six numeric digits including leading zeros', () => {
  assert.equal(isValidReporterVerificationCode('000123'), true);
  assert.equal(isValidReporterVerificationCode('123456'), true);
});
test('rejects incorrect code lengths and nonnumeric codes', () => {
  for (const code of ['12345', '1234567', '12a456', '\\d{6}', '']) {
    assert.equal(isValidReporterVerificationCode(code), false, code);
  }
});
test('collapses whitespace in reporter name without changing other characters', () => {
  assert.equal(normalizeReporterName('  Michael   Cuneo  '), 'Michael Cuneo');
  assert.equal(normalizeReporterName('Jo\tSmith'), 'Jo Smith');
});
