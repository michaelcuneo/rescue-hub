import { json } from '@sveltejs/kit';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { getRescue } from '$lib/server/graphql';
import { createAnimal, getAnimal, listRescueAnimals, changeAnimalState, AnimalConflict } from '$lib/server/animals';
import { canUpdateOwnRescue, validateQuickVetAction, quickVetStep } from '../../../../../../../../core/field-rescue-progress';
import type { RequestHandler } from './$types';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
async function registeredQuickAnimal(rescueId: string) {
  // Strongly consistent read after any competing quick-registration request.
  const row = await db.send(new GetCommand({
    TableName: Resource.RescueHubData.name,
    Key: { pk: `RESCUE#${rescueId}`, sk: 'META' },
    ConsistentRead: true
  }));
  return typeof row.Item?.quickAnimalId === 'string' ? getAnimal(row.Item.quickAnimalId) : null;
}

/** One action per milestone, not a wizard. The permanent animal record is
 * created exactly once when the first collected animal is progressed.
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  const rescue = user ? await getRescue(params.id) : null;
  if (!canUpdateOwnRescue(user, rescue))
    return json({ error: 'Only the assigned, active member can update this rescue.' }, { status: 403 });
  if (!rescue!.pickedUpAt)
    return json({ error: 'First select Animal collected. This prevents recording a handover before collection.' }, { status: 409 });
  let command: ReturnType<typeof validateQuickVetAction>;
  try { command = validateQuickVetAction(await request.json()); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid update.' }, { status: 400 }); }

  try {
    const animals = await listRescueAnimals(rescue!.id, rescue!.organisationId!);
    let animal = command.animalId
      ? animals.find(item => item.id === command.animalId)
      : animals.length === 1 ? animals[0] : null;
    if (!animal && !command.animalId && animals.length === 0) {
      animal = await registeredQuickAnimal(rescue!.id);
      if (!animal) {
        try {
          animal = await createAnimal({
            rescueId: rescue!.id,
            organisationId: rescue!.organisationId!,
            species: rescue!.type.trim() || 'Unidentified animal',
            description: rescue!.injury?.trim() || undefined,
            custodianUserId: user!.id,
            location: rescue!.location ?? undefined,
            quickRegistration: true
          });
        } catch (error) {
          // Another tap/device may already have registered the single animal.
          animal = await registeredQuickAnimal(rescue!.id);
          if (!animal) throw error;
        }
      }
    }
    if (!animal)
      return json({ error: command.animalId ? 'Animal not found in this rescue.' :
        'This rescue has multiple animals. Choose which animal you are transporting.' }, { status: 409 });
    if (animal.currentCustodianUserId !== user!.id)
      return json({ error: 'The animal is currently with another responsible person.' }, { status: 403 });
    if (animal.pendingTransferId)
      return json({ error: 'A handover is already awaiting acceptance. Please resolve it first.' }, { status: 409 });

    const stage = quickVetStep(animal.status);
    if (stage === 'OTHER')
      return json({ error: 'This animal cannot be moved to veterinary care from its current status.' }, { status: 409 });
    if (stage === 'AT_VET')
      return json({ animal, message: 'Veterinary drop-off already recorded. The animal remains in ongoing care.' });

    if (command.kind === 'GOING_TO_VET') {
      if (stage === 'TRAVELLING')
        return json({ animal, message: 'Already marked as travelling to the vet.' });
      // Clinic can be nominated later; this is an in-transit status, not a transfer.
      animal = await changeAnimalState(animal, user!.id, {
        kind: 'VET_TRANSPORT_STARTED',
        location: command.clinic || 'Veterinary facility (to be confirmed)',
        notes: command.notes
      });
      return json({ animal, message: 'Travelling to the vet. Record drop-off when the clinic receives the animal.' });
    }

    // A simple one-step dropoff also works for members who forgot to mark the
    // travel milestone. It records clinic physical custody, not a final outcome.
    animal = await changeAnimalState(animal, user!.id, {
      kind: 'VET_DROPOFF', location: command.clinic, notes: command.notes
    });
    return json({ animal, message: 'Handed to vet. The clinic holds the animal; its record stays open for updates and future transport.' });
  } catch (error) {
    if (error instanceof AnimalConflict) return json({ error: error.message }, { status: 409 });
    console.error('Rescue veterinary progress failed:', error);
    return json({ error: 'Could not save the update. Please retry.' }, { status: 503 });
  }
};
