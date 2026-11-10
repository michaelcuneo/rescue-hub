/**
 * Public account input validation, kept separate from SST / AWS so it can be
 * tested without a deployed backend.
 */
export function isValidReporterEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidReporterVerificationCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function normalizeReporterName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
