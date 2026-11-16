import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canCorrectMistakenPickup } from './pickup-correction.ts';
import { shouldShowRescuePin } from './case-map-visibility.ts';

const rescue={
 id:'r1',organisationId:'hwr',assignedUserId:'me',status:'ASSIGNED',
 pickedUpAt:'2026-11-16T01:00:00Z',quickAnimalId:'a1',animalCount:1
};
const animal={
 id:'a1',rescueId:'r1',organisationId:'hwr',currentCustodianUserId:'me',
 status:'IN_RESCUE',version:1
};
test('only untouched first auto-registration can be reversed',()=>{
 assert.equal(canCorrectMistakenPickup(rescue,animal,'me',['ANIMAL_REGISTERED']),true);
 const deniedRescues=[
  {...rescue,status:'COMPLETED'}, {...rescue,pickedUpAt:null},
  {...rescue,assignedUserId:'other'}, {...rescue,animalCount:2},
  {...rescue,quickAnimalId:null}, {...rescue,transportAnimalId:'a1'}
 ];
 deniedRescues.forEach(candidate=>assert.equal(canCorrectMistakenPickup(candidate,animal,'me',['ANIMAL_REGISTERED']),false));
 const deniedAnimals=[
  {...animal,status:'IN_TRANSIT'}, {...animal,status:'AT_VET'}, {...animal,status:'IN_CARE'},
  {...animal,status:'RELEASED'}, {...animal,version:2},
  {...animal,pendingTransferId:'transfer'}, {...animal,activeTransportRescueId:'pickup'},
  {...animal,reservedCarerUserId:'carer'}, {...animal,currentCustodianUserId:'another'},
  {...animal,registrationVoidedAt:'2026-11-16T02:00:00Z'}
 ];
 deniedAnimals.forEach(candidate=>assert.equal(canCorrectMistakenPickup(rescue,candidate,'me',['ANIMAL_REGISTERED']),false));
 assert.equal(canCorrectMistakenPickup(rescue,animal,'me',['ANIMAL_REGISTERED','TREATMENT']),false);
 assert.equal(canCorrectMistakenPickup(rescue,animal,'other',['ANIMAL_REGISTERED']),false);
});
test('collected rescue retains assignment history but has no operational pin',()=>{
 assert.equal(shouldShowRescuePin(rescue),false);
 assert.equal(shouldShowRescuePin({...rescue,pickedUpAt:null}),true);
});
