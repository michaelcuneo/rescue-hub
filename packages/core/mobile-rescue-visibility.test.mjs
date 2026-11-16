import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mobileRescueVisibility } from './mobile-rescue-visibility.ts';

const staff={id:'me',organisationId:'hwr',roles:['RESCUER']};
const platform={id:'me',roles:['PLATFORM_ADMIN']};
test('assigned cases remain visible after pickup, vet, transfer or final outcome',()=>{
 for(const status of ['ASSIGNED','COMPLETED','CANCELLED']){
  assert.equal(mobileRescueVisibility(staff,{organisationId:'hwr',assignedUserId:'me',status},false,false),'MY_ASSIGNMENT');
 }
});
test('platform admin without organisation sees only cases personally assigned',()=>{
 const mine={organisationId:'other',assignedUserId:'me',status:'ASSIGNED'};
 assert.equal(mobileRescueVisibility(platform,mine,false,false),'MY_ASSIGNMENT');
 assert.equal(mobileRescueVisibility(platform,{...mine,assignedUserId:'someone'},false,false),null);
 assert.equal(mobileRescueVisibility(platform,{...mine,assignedUserId:null,status:'PENDING'},false,true),null);
});
test('new rescue eligibility never follows from being a platform administrator',()=>{
 const open={organisationId:'hwr',assignedUserId:null,status:'PENDING'};
 assert.equal(mobileRescueVisibility({...staff,roles:[]},open,false,false),null);
 assert.equal(mobileRescueVisibility(staff,open,false,true),'QUALIFIED_PENDING');
});
test('organisation dispatchers may monitor own org but not other organisation',()=>{
 const user={id:'dispatcher',organisationId:'hwr',roles:['DISPATCHER']};
 assert.equal(mobileRescueVisibility(user,{organisationId:'hwr',status:'ASSIGNED'},false,false),'COORDINATOR');
 assert.equal(mobileRescueVisibility(user,{organisationId:'other',status:'ASSIGNED'},false,false),null);
});
