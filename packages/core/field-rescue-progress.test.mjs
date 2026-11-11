import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canUpdateOwnRescue,validateQuickVetAction,quickVetStep} from './field-rescue-progress.ts';
const u={id:'a',organisationId:'org',enabled:true,status:'ACTIVE'};
const r={organisationId:'org',assignedUserId:'a',status:'ASSIGNED'};
test('claimed cases remain editable after pickup regardless of role label',()=> {
 assert.equal(canUpdateOwnRescue(u,r),true);
 assert.equal(canUpdateOwnRescue({...u,id:'other'},r),false);
 assert.equal(canUpdateOwnRescue(u,{...r,status:'COMPLETED'}),false);
 assert.equal(canUpdateOwnRescue(u,{...r,transportAnimalId:'animal'}),false);
 assert.equal(canUpdateOwnRescue({...u,enabled:false},r),false);
});
test('vet dropoff requires named destination and collection is not a final outcome',()=> {
 assert.equal(validateQuickVetAction({kind:'GOING_TO_VET'}).clinic,'');
 assert.throws(()=>validateQuickVetAction({kind:'HANDED_TO_VET',clinic:''}),/clinic/);
 assert.equal(validateQuickVetAction({kind:'HANDED_TO_VET',clinic:' AREC '}).clinic,'AREC');
 assert.equal(quickVetStep('AT_VET'),'AT_VET');
 assert.equal(quickVetStep('IN_TRANSIT'),'TRAVELLING');
 assert.equal(quickVetStep('IN_RESCUE'),'READY');
});
