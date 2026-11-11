/** Reconcile two independent projections of the SAME rescue table. AppSync
 * pagination may return a non-empty but stale list, while the DynamoDB GSI
 * already contains a newly created case. Never discard one source simply
 * because the other returned something.
 */
export function reconcileRescueSnapshots<T extends {
  id: string; updatedAt?: string | null
}>(appsync: T[], dynamo: T[]): T[] {
  const entries = new Map<string, T>();
  for (const rescue of appsync) entries.set(rescue.id, rescue);
  for (const rescue of dynamo) {
    const existing = entries.get(rescue.id);
    // On equal timestamps trust the DynamoDB dispatch index (desktop view).
    if (!existing || !existing.updatedAt || !rescue.updatedAt ||
        rescue.updatedAt >= existing.updatedAt) entries.set(rescue.id, rescue);
  }
  return [...entries.values()].sort((a, b) =>
    (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}
