/** Public, third-party announcements only. Never reads Codex account data. */
export const RESET_API_BASE = 'https://codex-resets.com/api/v1';
export const RESET_MODEL_VERSION = 'conditional-intervals-v1';
export const RESET_MAX_AGE_HOURS = 24;
const HOUR = 3_600_000;
const SOURCE = Object.freeze({
  name: 'Codex Resets',
  url: 'https://codex-resets.com/',
  apiUrl: 'https://codex-resets.com/api/docs',
  attribution: 'Public announcements compiled by Codex Resets; summaries and conservative classification by ZequnWeb.',
  confirmationNote: 'Confirmed means completion is reported by the third-party feed or its supplied announcement text. Original posts and individual accounts have not been independently verified.',
});

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value;
}
function iso(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ${label} timestamp`);
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) throw new Error(`Invalid ${label} timestamp`);
  return new Date(value).toISOString();
}
function clock(value = Date.now()) {
  const result = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : value;
  if (!Number.isFinite(result)) throw new Error('Invalid as-of timestamp');
  return result;
}
function url(value, label) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`Invalid ${label} URL`); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname.includes('.')) throw new Error(`Invalid ${label} URL`);
  return parsed.href;
}
function requiredText(value, label, maximum = 30_000) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`Invalid ${label}`);
  return value.trim();
}

function wording(text) {
  const clean = text.replace(/https?:\/\/\S+/g, '').replace(/&amp;/g, '&').replace(/\*+/g, '').replace(/[’‘]/g, "'");
  // A banked credit does not itself replenish a user's active allowance.
  const banked = /\b(?:banked reset|reset bank|into (?:your|the) bank)\b/i.test(clean);
  const completion = /\b(?:i|we)(?:\s+have|\s*'ve)\s+(?:now\s+)?reset\s+(?:the\s+)?(?:everyone's\s+|codex\s+)?(?:usage|rate|limits|everyone's)/i.test(clean)
    || /\b(?:usage|rate)\s+limits\s+have\s+(?:now\s+)?been\s+reset\b/i.test(clean)
    || /\breset\s+(?:has\s+been\s+|all\s+)?propagated\b/i.test(clean)
    || /\ball\s+reset\s+for\s+everyone\b/i.test(clean)
    || /\bwe\s+did\s+a\s+\w+\s+double\s+reset\b/i.test(clean);
  const bankedOnly = banked && !completion && !/\b(?:usage|rate)\s+limits?\s+will\s+be\s+(?:fully\s+)?reset\b/i.test(clean);
  const future = /\b(?:will|incoming|lands?\s+(?:in|end)|landing\s+in|should\s+(?:land|be showing)|propagating\s+in|in\s+the\s+next|resetting|reseting)\b/i.test(clean);
  const bankedComplete = /\b(?:have\s+added|added|have\s+credited|credited)\s+(?:a|one|\d+)\s+banked\s+reset\b/i.test(clean);
  // Unknown eligibility stays unknown; a vague "all propagated" is not plan scope.
  const scope = /\ball\s+paid\b/i.test(clean)
    ? 'paid-plans'
    : /\ball\s+(?:(?:chatgpt\s+work\s+and\s+codex|codex\s+and\s+chatgpt\s+work|codex)\s+)?(?:users|accounts|plans)\b|\bfor\s+everyone\b|\beveryone's\s+(?:codex\s+)?(?:usage|limits)\b/i.test(clean)
      ? 'all-plans' : 'unspecified';
  return { completion: Boolean(completion), bankedOnly, bankedComplete, future, scope };
}

function normalizeEvent(raw, { latestId, asOf, scheduled = false, warnings }) {
  object(raw, 'reset event');
  const id = requiredText(raw.id, 'event id', 200);
  if (!['regular', 'banked'].includes(raw.reset_type)) throw new Error(`Unknown reset type for ${id}`);
  const announcedAt = iso(raw.announced_at, 'event');
  const suppliedText = requiredText(raw.text, 'announcement');
  const source = object(raw.source, 'event source');
  if (!['x_post', 'observed'].includes(source.type)) throw new Error(`Unknown source type for ${id}`);
  const sourceUrl = url(source.url, 'event source');
  if (source.type === 'x_post' && !/^https:\/\/(?:www\.)?(?:x|twitter)\.com\/[^/]+\/status\/\d+(?:[/?#]|$)/.test(sourceUrl)) throw new Error(`Invalid X source URL for ${id}`);
  const words = wording(suppliedText);
  const type = words.bankedOnly ? 'banked' : raw.reset_type;
  if (type !== raw.reset_type) warnings.push(`Reclassified ${id} as a banked credit from the supplied text; provider type was ${raw.reset_type}.`);
  const futureTimestamp = Date.parse(announcedAt) > asOf;
  const providerLatest = id === latestId && !scheduled && raw.status !== 'scheduled';
  const completion = type === 'banked' ? words.bankedComplete : words.completion;
  const status = futureTimestamp ? 'unverified' : scheduled || raw.status === 'scheduled' ? 'announced' : providerLatest || completion ? 'confirmed' : words.future || type === 'banked' ? 'announced' : 'unverified';
  const confirmationBasis = status !== 'confirmed' ? 'none' : providerLatest ? 'provider-latest' : 'completion-wording';
  const summary = type === 'banked'
    ? status === 'confirmed' ? 'The supplied announcement reports a banked reset credit. Redeeming a credit is separate from a general quota reset.' : 'A banked reset credit is announced. Distribution is not confirmed by this tracker.'
    : status === 'confirmed' ? 'The supplied source reports that a Codex usage reset has been applied. Account eligibility and receipt may vary.'
      : status === 'announced' ? 'A Codex usage reset is announced or being rolled out. This record does not establish completed delivery.'
        : 'The feed includes a Codex reset-related record, but the supplied wording does not establish completion.';
  return {
    id, announcedAt, type, status, summary, sourceUrl, sourceKind: source.type,
    scope: words.scope, roundId: requiredText(raw.round_id || raw.roundId || sourceUrl.replace(/[?#].*$/, ''), 'round id', 600), confirmationBasis,
  };
}

function deduplicate(events) {
  const result = [];
  const rank = { confirmed: 3, announced: 2, unverified: 1 };
  for (const event of events) {
    const index = result.findIndex((other) => other.id === event.id || other.sourceUrl === event.sourceUrl || (other.roundId === event.roundId && other.type === event.type));
    if (index < 0) result.push(event);
    else if (rank[event.status] > rank[result[index].status] || (rank[event.status] === rank[result[index].status] && event.announcedAt > result[index].announcedAt)) result[index] = event;
  }
  return result.sort((a, b) => b.announcedAt.localeCompare(a.announcedAt) || a.id.localeCompare(b.id));
}

/** Throws on malformed data; callers retain their last successful snapshot. */
export function normalizeSnapshot({ status, history, fetchedAt }, now = Date.now()) {
  const asOf = clock(now);
  object(status, 'status envelope'); object(status.data, 'status data'); object(status.meta, 'status meta');
  const pages = Array.isArray(history) ? history : [history];
  if (!pages.length) throw new Error('Empty history pages');
  const fetched = iso(fetchedAt, 'fetch');
  if (Date.parse(fetched) > asOf + 5 * 60_000) throw new Error('Fetch timestamp is in the future');
  const generated = [iso(status.meta.generated_at, 'status generation')];
  const rows = [];
  let historyComplete = false;
  for (const [index, page] of pages.entries()) {
    object(page, 'history envelope'); object(page.meta, 'history meta'); object(page.pagination, 'history pagination');
    if (!Array.isArray(page.data) || typeof page.pagination.has_more !== 'boolean') throw new Error('Invalid history page');
    if (page.pagination.has_more && (typeof page.pagination.next_cursor !== 'string' || !page.pagination.next_cursor)) throw new Error('Missing pagination cursor');
    if (index < pages.length - 1 && !page.pagination.has_more) throw new Error('Unexpected page after complete history');
    generated.push(iso(page.meta.generated_at, 'history generation'));
    rows.push(...page.data);
    historyComplete = !page.pagination.has_more;
  }
  if (!rows.length) throw new Error('Empty history; retaining the last successful snapshot is required');
  if (generated.some((value) => Date.parse(value) > asOf + 5 * 60_000)) throw new Error('Source generation timestamp is in the future');
  const warnings = [];
  const latestId = status.data.latest_reset?.id;
  const options = { latestId, asOf: Math.min(asOf, ...generated.map(Date.parse)), warnings };
  const events = rows.map((row) => normalizeEvent(row, options));
  if (status.data.latest_reset) events.push(normalizeEvent(status.data.latest_reset, options));
  let scheduled = null;
  if (status.data.scheduled_reset) {
    const raw = status.data.scheduled_reset;
    scheduled = { ...normalizeEvent(raw, { ...options, scheduled: true }), scheduledFor: raw.scheduled_for ? iso(raw.scheduled_for, 'scheduled reset') : null };
  }
  let watch = null;
  if (status.data.active_watch) {
    const raw = object(status.data.active_watch, 'watch');
    const observedAt = iso(raw.observed_at, 'watch observation');
    const expiresAt = iso(raw.expires_at, 'watch expiration');
    if (Date.parse(expiresAt) <= Date.parse(observedAt)) throw new Error('Invalid watch expiration');
    watch = {
      level: requiredText(raw.level, 'watch level', 100), observedAt, expiresAt,
      summary: 'The data provider flags a reset-related public signal. This is an unverified signal, not a commitment or a calibrated probability.',
      sourceUrl: url(object(raw.source, 'watch source').url, 'watch source'),
      forecastWindow: typeof raw.forecast_window === 'string' ? raw.forecast_window.slice(0, 200) : null,
    };
  }
  return {
    schemaVersion: 1, generatedAt: generated.sort()[0], fetchedAt: fetched,
    events: deduplicate(events), scheduled, watch, source: { ...SOURCE }, historyComplete,
    rawEventCount: rows.length, warnings: [...new Set(warnings)],
  };
}

function validateEvent(event) {
  object(event, 'normalized event');
  for (const key of ['id', 'summary', 'roundId']) requiredText(event[key], `event ${key}`);
  iso(event.announcedAt, 'event'); url(event.sourceUrl, 'event source');
  for (const [key, allowed] of Object.entries({ type: ['regular', 'banked'], status: ['confirmed', 'announced', 'unverified'], sourceKind: ['x_post', 'observed'], scope: ['all-plans', 'paid-plans', 'unspecified'], confirmationBasis: ['provider-latest', 'completion-wording', 'none'] })) {
    if (!allowed.includes(event[key])) throw new Error(`Invalid event ${key}`);
  }
  if ((event.status === 'confirmed') !== (event.confirmationBasis !== 'none')) throw new Error('Inconsistent event confirmation');
  return event;
}

/** Validates snapshots received from our optional Worker, without changing freshness. */
export function validateSnapshot(snapshot) {
  object(snapshot, 'snapshot');
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.events) || !snapshot.events.length || typeof snapshot.historyComplete !== 'boolean' || !Number.isInteger(snapshot.rawEventCount) || snapshot.rawEventCount < 1) throw new Error('Invalid snapshot schema');
  iso(snapshot.generatedAt, 'source generation'); iso(snapshot.fetchedAt, 'fetch');
  if (Date.parse(snapshot.generatedAt) > Date.parse(snapshot.fetchedAt) + 5 * 60_000) throw new Error('Invalid source generation time');
  snapshot.events.forEach(validateEvent);
  if (snapshot.scheduled) { validateEvent(snapshot.scheduled); if (snapshot.scheduled.status !== 'announced') throw new Error('Scheduled event cannot be confirmed'); if (snapshot.scheduled.scheduledFor) iso(snapshot.scheduled.scheduledFor, 'scheduled'); }
  if (snapshot.watch) {
    object(snapshot.watch, 'watch'); iso(snapshot.watch.observedAt, 'watch'); iso(snapshot.watch.expiresAt, 'watch expiration'); url(snapshot.watch.sourceUrl, 'watch source'); requiredText(snapshot.watch.summary, 'watch summary'); requiredText(snapshot.watch.level, 'watch level');
  }
  object(snapshot.source, 'snapshot source');
  for (const key of ['name', 'attribution', 'confirmationNote']) requiredText(snapshot.source[key], `source ${key}`);
  url(snapshot.source.url, 'provider'); url(snapshot.source.apiUrl, 'provider documentation');
  if (!Array.isArray(snapshot.warnings) || snapshot.warnings.some((item) => typeof item !== 'string')) throw new Error('Invalid warnings');
  return snapshot;
}

/**
 * A descriptive conditional frequency, not a calibrated prediction.
 * Only adjacent eligible completed announcements form a historical interval.
 * Ambiguous regular events break the chain, preventing false long intervals.
 */
export function forecastReset(events, asOf, windowHours = 48, options = {}) {
  const now = clock(asOf);
  if (!Array.isArray(events) || !Number.isFinite(windowHours) || windowHours <= 0 || windowHours > 8760) throw new Error('Invalid forecast input');
  const scope = options.scope || 'paid-plans';
  if (!['paid-plans', 'all-plans', 'public-reset-events'].includes(scope)) throw new Error('Invalid forecast scope');
  // Public-event scope estimates announcement arrivals, never account eligibility.
  const eligible = (event) => event.status === 'confirmed' && (scope === 'public-reset-events' || event.scope === scope || (scope === 'paid-plans' && event.scope === 'all-plans'));
  const regular = deduplicate(events.map(validateEvent)).filter((event) => event.type === 'regular' && Date.parse(event.announcedAt) <= now).reverse();
  const completed = regular.filter(eligible);
  const last = completed.at(-1);
  const elapsedHours = last ? (now - Date.parse(last.announcedAt)) / HOUR : null;
  const intervals = [];
  for (let index = 1; index < regular.length; index++) {
    if (!eligible(regular[index - 1]) || !eligible(regular[index])) continue;
    const duration = (Date.parse(regular[index].announcedAt) - Date.parse(regular[index - 1].announcedAt)) / HOUR;
    if (duration > 0) intervals.push(duration);
  }
  const surviving = elapsedHours === null ? [] : intervals.filter((duration) => duration > elapsedHours);
  const matched = surviving.filter((duration) => duration <= elapsedHours + windowHours);
  let reason = !last ? 'no-confirmed-events' : surviving.length < 5 ? 'insufficient-samples' : 'available';
  // A later uncertain or ineligible event may already have reset the clock.
  if (last && regular.at(-1)?.id !== last.id) reason = 'unverified-events';
  if (options.historyComplete === false) reason = 'incomplete-history';
  if (options.generatedAt) {
    const generatedAt = Date.parse(iso(options.generatedAt, 'source generation'));
    const maximum = options.maxAgeHours ?? RESET_MAX_AGE_HOURS;
    if (!Number.isFinite(maximum) || maximum <= 0) throw new Error('Invalid maximum data age');
    if (now - generatedAt > maximum * HOUR || generatedAt > now + 5 * 60_000) reason = 'stale-data';
  }
  return {
    asOf: new Date(now).toISOString(), windowHours, lastResetAt: last?.announcedAt || null,
    elapsedHours, matchedIntervals: matched.length, eligibleIntervals: surviving.length,
    intervalCount: intervals.length, percent: reason === 'available' ? Math.round(matched.length / surviving.length * 1000) / 10 : null,
    reason, modelVersion: RESET_MODEL_VERSION, scope,
  };
}

/** Read-only public API request, following every cursor; no tight retry on limits. */
export async function fetchResetSnapshot({ fetchImpl = globalThis.fetch, signal, now } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable');
  const request = async (endpoint) => {
    const timeout = AbortSignal.timeout(20_000);
    const response = await fetchImpl(endpoint, { headers: { Accept: 'application/json' }, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    if (!response.ok) {
      const error = new Error(response.status === 429 ? `Source rate limit reached; retry after ${response.headers.get('Retry-After') || 'the source cache expires'}.` : `Reset source returned HTTP ${response.status}`);
      error.status = response.status;
      error.retryAfter = response.headers.get('Retry-After');
      throw error;
    }
    return response.json();
  };
  const status = await request(`${RESET_API_BASE}/status`);
  const history = [];
  const cursors = new Set();
  let cursor = null;
  do {
    const query = new URLSearchParams({ limit: '100', order: 'desc' });
    if (cursor) query.set('cursor', cursor);
    const page = await request(`${RESET_API_BASE}/resets?${query}`);
    history.push(page);
    if (!page.pagination || typeof page.pagination.has_more !== 'boolean') throw new Error('Invalid source pagination');
    cursor = page.pagination.has_more ? page.pagination.next_cursor : null;
    if (page.pagination.has_more && (typeof cursor !== 'string' || !cursor || cursors.has(cursor) || history.length >= 50)) throw new Error('Invalid or excessive source pagination');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  const fetched = new Date(clock(now ?? Date.now())).toISOString();
  return normalizeSnapshot({ status, history, fetchedAt: fetched }, fetched);
}
