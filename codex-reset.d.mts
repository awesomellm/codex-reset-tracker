export type ResetScope = 'all-plans' | 'paid-plans' | 'unspecified';
export type ResetEvent = {
  id: string; announcedAt: string; type: 'regular' | 'banked';
  status: 'confirmed' | 'announced' | 'unverified'; summary: string; sourceUrl: string;
  sourceKind: 'x_post' | 'observed'; scope: ResetScope; roundId: string;
  confirmationBasis: 'provider-latest' | 'completion-wording' | 'none';
};
export type ResetSnapshot = {
  schemaVersion: 1; generatedAt: string; fetchedAt: string; events: ResetEvent[];
  scheduled: (ResetEvent & { scheduledFor: string | null }) | null;
  watch: { level: string; observedAt: string; expiresAt: string; summary: string; sourceUrl: string; forecastWindow: string | null } | null;
  source: { name: string; url: string; apiUrl: string; attribution: string; confirmationNote: string };
  historyComplete: boolean; rawEventCount: number; warnings: string[];
  ingestion?: { lastAttemptAt?: string | null; lastSuccessAt?: string | null; nextAttemptAt?: string | null; lastError?: string | null; stale?: boolean };
};
export type ResetForecast = {
  asOf: string; windowHours: number; lastResetAt: string | null; elapsedHours: number | null;
  matchedIntervals: number; eligibleIntervals: number; intervalCount: number; percent: number | null;
  reason: 'available' | 'insufficient-samples' | 'no-confirmed-events' | 'stale-data' | 'incomplete-history' | 'unverified-events';
  modelVersion: string; scope: 'paid-plans' | 'all-plans' | 'public-reset-events';
};
export const RESET_API_BASE: string;
export const RESET_MODEL_VERSION: string;
export const RESET_MAX_AGE_HOURS: number;
export function normalizeSnapshot(input: { status: unknown; history: unknown; fetchedAt: string }, now?: string | number | Date): ResetSnapshot;
export function validateSnapshot(snapshot: unknown): ResetSnapshot;
export function forecastReset(events: ResetEvent[], asOf: string | number | Date, windowHours?: number, options?: { generatedAt?: string; historyComplete?: boolean; maxAgeHours?: number; scope?: 'paid-plans' | 'all-plans' | 'public-reset-events' }): ResetForecast;
export function fetchResetSnapshot(options?: { fetchImpl?: typeof fetch; signal?: AbortSignal; now?: string | number | Date }): Promise<ResetSnapshot>;
