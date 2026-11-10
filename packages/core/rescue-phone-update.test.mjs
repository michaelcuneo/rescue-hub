import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePhoneUpdate } from './rescue-phone-update.ts';

const animalId = 'b38dd56d-7d84-4dd8-bbfa-e1fd509afaa0';

test('vet can telephone a dispatch office without an app account', () => {
  const update = validatePhoneUpdate({
    animalId, callerName: '  Northside   Vet Clinic ', callerRole: 'VET',
    notes: 'Animal assessed, ready for collection.', callbackPermitted: false
  });
  assert.equal(update.callerName, 'Northside Vet Clinic');
  assert.equal(update.requestTransport, false);
  assert.equal(update.callbackPhone, undefined);
});
test('transport requires registered animal, verified pickup address and coordinates', () => {
  const base = { animalId, callerName:'Vet',callerRole:'VET',notes:'Ready to collect',requestTransport:true };
  assert.throws(()=>validatePhoneUpdate(base),/pickup/i);
  assert.throws(()=>validatePhoneUpdate({...base,animalId:undefined,pickupLocation:'Vet Clinic, NSW',pickupLatitude:-32.91,pickupLongitude:151.72}),/animal/i);
  assert.throws(()=>validatePhoneUpdate({...base,pickupLocation:'Vet Clinic, NSW',pickupLatitude:91,pickupLongitude:151.72}),/pickup/i);
  const accepted=validatePhoneUpdate({...base,pickupLocation:'Vet Clinic, NSW',pickupLatitude:-32.91,pickupLongitude:151.72});
  assert.equal(accepted.requestTransport,true);
  assert.equal(accepted.pickupLongitude,151.72);
  assert.equal(accepted.pickupLocation,'Vet Clinic, NSW');
});
test('explicit caller permission is needed to retain callback numbers',()=>{
 const caller={callerName:'Volunteer',notes:'Status unchanged',callbackPhone:'0412 345 678'};
 assert.equal(validatePhoneUpdate(caller).callbackPhone,undefined);
 assert.equal(validatePhoneUpdate({...caller,callbackPermitted:true}).callbackPhone,'0412 345 678');
 assert.throws(()=>validatePhoneUpdate({...caller,callbackPermitted:true,callbackPhone:'abc'}),/number/i);
});
test('rejects missing attribution, empty observation and unknown role',()=>{
 assert.throws(()=>validatePhoneUpdate({callerName:' ',notes:'Information'}),/who called/i);
 assert.throws(()=>validatePhoneUpdate({callerName:'Vet',notes:' '}),/telephone update/i);
 assert.throws(()=>validatePhoneUpdate({callerName:'Vet',notes:'Information',callerRole:'UNKNOWN'}),/caller role/i);
});

test('vet may report euthanasia without needing an app account', () => {
  const value = validatePhoneUpdate({
    animalId, callerName: 'AREC night veterinarian', callerRole: 'VET',
    notes: 'Veterinarian confirmed euthanasia following clinical assessment.',
    finalOutcome: 'EUTHANISED'
  });
  assert.equal(value.finalOutcome, 'EUTHANISED');
  assert.equal(value.callerRole, 'VET');
  assert.equal(value.requestTransport, false);
});
test('reported euthanasia cannot create a pickup job', () => {
  assert.throws(() => validatePhoneUpdate({
    animalId, callerName: 'AREC', callerRole: 'VET', notes: 'Animal was euthanised.',
    finalOutcome: 'EUTHANISED', requestTransport: true
  }), /veterinary final outcome/i);
});
test('only a vet report may close care through the phone pathway', () => {
  for (const role of ['REPORTER', 'RESCUER', 'OTHER']) {
    assert.throws(() => validatePhoneUpdate({
      animalId, callerName: 'Caller', callerRole: role, notes: 'Animal died at clinic.',
      finalOutcome: 'DECEASED'
    }), /veterinary final outcome/i);
  }
});
