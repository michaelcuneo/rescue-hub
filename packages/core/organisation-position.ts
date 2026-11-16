/** Validates human-facing organisation titles without altering the name.
 * A literal character class is essential: doubled backslashes would reject
 * common letters such as those in "President" or "Secretary".
 */
export function validateOrganisationPositionName(input: unknown): { name: string; id: string } {
  const name = typeof input === 'string' ? input.trim() : '';
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('Enter a position name of up to 80 readable characters.');
  }
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);
  if (!id) throw new Error('Position must contain letters or numbers.');
  return { name, id };
}
