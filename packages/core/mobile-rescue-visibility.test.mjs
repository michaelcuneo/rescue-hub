import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVisibleMobileWorkItem, mobileRescueVisibility } from './mobile-rescue-visibility.ts';

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
test('coordinator roles never broaden the field volunteer feed',()=>{
 const open={organisationId:'hwr',assignedUserId:null,status:'PENDING'};
 const assignedElsewhere={...open,status:'ASSIGNED',assignedUserId:'another-volunteer'};
 for (const roles of [
   ['DISPATCHER'],['ORG_ADMIN'],['PLATFORM_ADMIN'],['AUTHORITY_ADMIN'],
   ['DISPATCHER','RESCUER'],['ORG_ADMIN','RESCUER']
 ]) {
   const user={...staff,roles};
   assert.equal(mobileRescueVisibility(user,open,false,false),null,roles.join(','));
   assert.equal(mobileRescueVisibility(user,assignedElsewhere,false,false),null,roles.join(','));
 }
 assert.equal(mobileRescueVisibility({...staff,roles:['DISPATCHER','RESCUER']},open,false,true),'QUALIFIED_PENDING');
 assert.equal(mobileRescueVisibility({...staff,roles:['ORG_ADMIN','RESCUER']},open,false,true),'QUALIFIED_PENDING');
 assert.equal(mobileRescueVisibility({...staff,roles:['ORG_ADMIN','RESCUER']},{...open,awaitingCarer:true},false,false),null);
 assert.equal(mobileRescueVisibility({...staff,roles:['DISPATCHER']},{...open,organisationId:'other'},false,true),null);
});
test('already-assigned rescues and current custody survive later changes in qualifications',()=>{
 const user={...staff,roles:[]};
 const caseFromMyOrganisation={organisationId:'hwr',status:'ASSIGNED',assignedUserId:'me'};
 assert.equal(mobileRescueVisibility(user,caseFromMyOrganisation,false,false),'MY_ASSIGNMENT');
 assert.equal(mobileRescueVisibility(user,{...caseFromMyOrganisation,assignedUserId:'someone'},true,false),'MY_CUSTODY');
 assert.equal(mobileRescueVisibility(user,{...caseFromMyOrganisation,organisationId:'other'},true,true),null);
});
test('transport and species rescue pending offers use one server-checked eligibility flag',()=>{
 const user={...staff,roles:[]};
 const rescue={organisationId:'hwr',status:'PENDING',assignedUserId:null};
 const transport={...rescue,transportAnimalId:'animal-1'};
 // This argument is computed from training for species jobs and canTransport
 // for transport jobs by the /api/mobile/rescues endpoint.
 assert.equal(mobileRescueVisibility(user,rescue,false,false),null);
 assert.equal(mobileRescueVisibility(user,rescue,false,true),'QUALIFIED_PENDING');
 assert.equal(mobileRescueVisibility(user,transport,false,false),null);
 assert.equal(mobileRescueVisibility(user,transport,false,true),'QUALIFIED_PENDING');
});
test('native client ignores older coordinator feed entries (fail closed)',()=>{
 for (const visibility of ['MY_ASSIGNMENT','MY_CUSTODY','QUALIFIED_PENDING']) {
   assert.equal(isVisibleMobileWorkItem({visibility}),true,visibility);
 }
 assert.equal(isVisibleMobileWorkItem({visibility:'COORDINATOR'}),false);
 assert.equal(isVisibleMobileWorkItem({}),false);
 assert.equal(isVisibleMobileWorkItem({visibility:null}),false);
});
