import { error, fail, redirect } from '@sveltejs/kit';
import { getAnimal, recordAnimalEvent, AnimalConflict } from '$lib/server/animals';
import { getVetClinic, listVetClinicAnimals } from '$lib/server/vet-clinics';
import { recordAnimalPhoneUpdate, AnimalPhoneConflict } from '$lib/server/animal-phone-updates';
import { canVetAccessAnimal, type VetActor } from '../../../../core/vet-access';
import { validatePhoneUpdate } from '../../../../core/rescue-phone-update';
import type { Actions, PageServerLoad } from './$types';
import type { RescueHubUser } from '$lib/server/auth';

async function requireVet(user: RescueHubUser | null) {
  if (!user) throw redirect(303, '/login?next=%2Fvet');
  if (!user.enabled || user.status !== 'ACTIVE' || user.roles.length !== 1 ||
      user.roles[0] !== 'VET_STAFF' || !user.organisationId || !user.vetClinicId)
    throw error(403, 'This workspace requires an approved veterinary clinic account.');
  const clinic = await getVetClinic(user.organisationId, user.vetClinicId);
  if (!clinic) throw error(403, 'This veterinary clinic is not approved for access.');
  return clinic;
}
export const load: PageServerLoad = async ({ locals }) => {
  const clinic = await requireVet(locals.user);
  const animals = await listVetClinicAnimals(clinic.organisationId, clinic.id);
  return { clinic: { name: clinic.name, address: clinic.address },
    animals: animals.map(animal => ({
      id: animal.id, species: animal.species, description: animal.description ?? '',
      vetStage: animal.vetStage ?? 'AWAITING_ASSESSMENT',
      updatedAt: animal.updatedAt, ready: Boolean(animal.activeTransportRescueId)
    })) };
};
async function withAnimal(
  user: RescueHubUser | null,
  request: Request,
  fn: (animal: NonNullable<Awaited<ReturnType<typeof getAnimal>>>, clinic:
    NonNullable<Awaited<ReturnType<typeof getVetClinic>>>, notes: string) => Promise<void>
) {
  const clinic = await requireVet(user);
  const form = await request.formData();
  const id = String(form.get('animalId') ?? '');
  if (!/^[a-f0-9-]{36}$/i.test(id)) return fail(400, { message: 'Choose a valid animal.' });
  const notes = typeof form.get('notes') === 'string' ? String(form.get('notes')).trim() : '';
  if (notes.length < 3 || notes.length > 4000)
    return fail(400, { message: 'Enter a veterinary update of 3–4,000 characters.' });
  const animal = await getAnimal(id);
  if (!canVetAccessAnimal(user as VetActor, animal)) return fail(403, { message: 'This animal is not assigned to your clinic.' });
  try {
    await fn(animal!, clinic, notes);
    return { success: true, message: 'Veterinary update recorded.' };
  } catch (issue) {
    if (issue instanceof AnimalPhoneConflict || issue instanceof AnimalConflict)
      return fail(409, { message: issue.message });
    console.error('Veterinary workspace update failed:', issue);
    return fail(503, { message: 'Could not record veterinary update. Please retry.' });
  }
}
export const actions: Actions = {
  assessment: async ({ locals, request }) => withAnimal(locals.user, request,
    async (animal, _clinic, notes) => {
      await recordAnimalEvent(animal, locals.user!.id, {
        type: 'VET_ASSESSMENT', notes, source: 'DIRECT',
        coordinatorOverride: true
      });
    }),
  ready: async ({ locals, request }) => withAnimal(locals.user, request,
    async (animal, clinic, notes) => {
      if (animal.activeTransportRescueId)
        throw new AnimalPhoneConflict('A collection request already exists for this animal.');
      const input = validatePhoneUpdate({
        callerName: locals.user!.name, callerRole: 'VET', notes,
        animalId: animal.id, requestTransport: true,
        pickupLocation: clinic.address,
        pickupLatitude: clinic.latitude, pickupLongitude: clinic.longitude,
        callbackPermitted: false
      });
      await recordAnimalPhoneUpdate(animal, locals.user!.id, input, 'VET_PORTAL');
    }),
  outcome: async ({ locals, request }) => {
    // Accept only explicit confirmed death/euthanasia; never silently close a case.
    const copy = request.clone();
    const form = await copy.formData();
    const outcome = form.get('outcome');
    if (outcome !== 'EUTHANISED' && outcome !== 'DECEASED')
      return fail(400, { message: 'Choose confirmed euthanasia or death.' });
    return withAnimal(locals.user, request, async (animal, _clinic, notes) => {
      const input = validatePhoneUpdate({
        callerName: locals.user!.name, callerRole: 'VET', notes,
        animalId: animal.id, requestTransport: false, finalOutcome: outcome,
        callbackPermitted: false
      });
      await recordAnimalPhoneUpdate(animal, locals.user!.id, input, 'VET_PORTAL');
    });
  }
};
