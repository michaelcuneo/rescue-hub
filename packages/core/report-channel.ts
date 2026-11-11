export type ReportChannel = 'PHONE' | 'ONLINE' | 'UNVERIFIED';
export type RescueOrigin = { id: string; intakeSource?: string | null };

/** Every intake is a public report. The channel is metadata, not a workflow. */
export function reportChannel(rescue: RescueOrigin): ReportChannel {
  if (rescue.id.startsWith('public-report-')) return 'ONLINE';
  if (rescue.intakeSource === 'PHONE') return 'PHONE';
  if (rescue.intakeSource === 'ONLINE') return 'ONLINE';
  return 'UNVERIFIED';
}
export function reportChannelLabel(rescue: RescueOrigin): string {
  switch (reportChannel(rescue)) {
    case 'PHONE': return 'Phone report';
    case 'ONLINE': return 'Online report';
    default: return 'Public report';
  }
}
