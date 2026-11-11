import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySpeciesCapability, findCatalogueGroup, matchesSpeciesTeam } from './dispatch-species.ts';
import { australianAnimalGroups } from '../pc-rescues/src/lib/data/australian-animals.ts';

test('cane toad is invasive amphibian, not a reptile or generic rescue', () => {
  assert.equal(classifySpeciesCapability('Cane toad', '', 'Amphibians'), 'INVASIVE');
  assert.equal(classifySpeciesCapability('Amphibian', 'Cane Toad'), 'INVASIVE');
  assert.equal(classifySpeciesCapability('Cane-toad'), 'INVASIVE');
  assert.equal(classifySpeciesCapability('Green tree frog', '', 'Amphibians'), 'AMPHIBIAN');
});
test('unknown snakes take specialist pathway and pythons remain nonvenomous', () => {
  assert.equal(classifySpeciesCapability('Unknown snake'), 'REPTILE_VENOMOUS');
  assert.equal(classifySpeciesCapability('Eastern small-eyed snake'), 'REPTILE_VENOMOUS');
  assert.equal(classifySpeciesCapability('Carpet python', '', 'Reptiles'), 'REPTILE_NON_VENOMOUS');
  assert.equal(classifySpeciesCapability('Water dragon', '', 'Reptiles'), 'REPTILE_NON_VENOMOUS');
});
test('native animal groups route by their actual group', () => {
  assert.equal(classifySpeciesCapability('Antechinus', '', 'Mammals'), 'MAMMAL');
  assert.equal(classifySpeciesCapability('Echidna', '', 'Mammals'), 'MAMMAL');
  assert.equal(classifySpeciesCapability('Emu', '', 'Birds'), 'BIRD');
  assert.equal(classifySpeciesCapability('Giant burrowing cockroach', '', 'Invertebrates'), 'INVERTEBRATE');
  assert.equal(classifySpeciesCapability('Domestic dog', '', 'Introduced and domestic'), 'NON_NATIVE');
  assert.equal(classifySpeciesCapability('Unknown animal'), 'OTHER');
});
test('specific breed matches a catalogued animal despite generic type', () => {
  const catalogue = { Amphibians:['Cane toad','Green tree frog'], Reptiles:['Water dragon'] };
  assert.equal(findCatalogueGroup('Reptiles','Cane toad',catalogue),'Amphibians');
  assert.equal(findCatalogueGroup('Cane toad','',catalogue),'Amphibians');
});

test('transport and generic teams cannot accept invasive or unclassified species by default', () => {
  assert.equal(matchesSpeciesTeam({ active:true, receivesAllRescues:true }, 'INVASIVE'), false);
  assert.equal(matchesSpeciesTeam({ active:true, receivesAllRescues:false, capabilityCode:'REPTILE_NON_VENOMOUS' }, 'INVASIVE'), false);
  assert.equal(matchesSpeciesTeam({ active:true, receivesAllRescues:false, capabilityCode:'INVASIVE' }, 'INVASIVE'), true);
  assert.equal(matchesSpeciesTeam({ active:false, receivesAllRescues:false, capabilityCode:'INVASIVE' }, 'INVASIVE'), false);
});

test('every named Australian animal in the intake catalogue has a dispatch category', () => {
  for (const [group, animals] of Object.entries(australianAnimalGroups)) {
    for (const species of animals) {
      const matchedGroup = findCatalogueGroup(species, '', australianAnimalGroups);
      assert.equal(matchedGroup, group, species);
      assert.notEqual(classifySpeciesCapability(species, '', matchedGroup), 'OTHER', species);
    }
  }
});
