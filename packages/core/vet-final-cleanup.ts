/** Delete all stale distribution pointers when a clinic records a terminal
 * outcome. The permanent animal history remains intact.
 * Return keys only: the caller performs these deletes in the same transaction
 * as the conditional final-outcome update.
 */
export function vetFinalCleanupKeys(animal: {
  id: string; organisationId: string; reservedCarerUserId?: string;
}): Array<{ pk: string; sk: string }> {
  const keys = [{ pk: `ORG#${animal.organisationId}#CARE_OFFERS`, sk: `ANIMAL#${animal.id}` }];
  if (animal.reservedCarerUserId) {
    keys.push({ pk: `USER#${animal.reservedCarerUserId}`, sk: `CARE_RESERVATION#${animal.id}` });
    keys.push({ pk: `ANIMAL#${animal.id}`, sk: 'CARE_DELIVERY' });
  }
  return keys;
}
