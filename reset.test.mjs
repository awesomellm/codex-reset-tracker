import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSnapshot, validateSnapshot, forecastReset, fetchResetSnapshot } from './codex-reset.mjs';

const NOW = '2026-09-13T12:00:00.000Z';
const hour = 3_600_000;
const at = (hours) => new Date(Date.parse(NOW) + hours * hour).toISOString();
const raw = (id = '123', text = 'We have reset usage limits for all paid users.', extra = {}) => ({
  id, reset_type: 'regular', announced_at: at(-2), text,
  source: { type: 'x_post', url: `https://x.com/thsottiaux/status/${id}` }, ...extra,
});
const envelope = (rows, more = false, cursor = null) => ({ data: rows, pagination: { has_more: more, next_cursor: cursor }, meta: { generated_at: at(-1) } });
const status = (latest = null, extra = {}) => ({ data: { latest_reset: latest, scheduled_reset: null, active_watch: null, ...extra }, meta: { generated_at: at(-0.5) } });
const normalize = (rows, stat = status(), more = false) => normalizeSnapshot({ status: stat, history: envelope(rows, more, more ? 'next' : null), fetchedAt: NOW }, NOW);
const event = (id, hours, extra = {}) => ({
  id: String(id), announcedAt: at(hours), type: 'regular', status: 'confirmed',
  summary: 'Test completed reset', sourceUrl: `https://x.com/thsottiaux/status/${id}`,
  sourceKind: 'x_post', scope: 'paid-plans', roundId: String(id), confirmationBasis: 'completion-wording', ...extra,
});

test('history type alone never proves completion; scheduled and vague text stay unconfirmed', () => {
  const rows = [raw('1', 'A reset will land in the next hour.'), raw('2', 'Hi. It is done.'), raw('3', 'We are resetting usage for all paid users.')];
  const snapshot = normalize(rows);
  assert.deepEqual(snapshot.events.map((item) => item.status), ['announced', 'unverified', 'announced']);
  const scheduled = normalize([raw('4')], status(null, { scheduled_reset: raw('5', 'We have reset usage limits for all paid users.', { scheduled_for: at(-1), status: 'scheduled' }) }));
  assert.equal(scheduled.scheduled.status, 'announced');
  assert.equal(scheduled.scheduled.confirmationBasis, 'none');
  assert.equal(scheduled.scheduled.scheduledFor, at(-1));
});

test('provider latest can confirm a regular record without guessing its plan scope', () => {
  const record = raw('1', 'Reset all propagated.');
  const snapshot = normalize([record], status(record));
  assert.equal(snapshot.events.length, 1);
  assert.equal(snapshot.events[0].status, 'confirmed');
  assert.equal(snapshot.events[0].scope, 'unspecified');
  assert.equal(snapshot.events[0].confirmationBasis, 'provider-latest');
});

test('banked-only corrections never contaminate quota reset statistics; double resets preserved', () => {
  const snapshot = normalize([
    raw('1', 'We have added a banked reset to everyone’s account.'),
    raw('2', 'I have reset everyone’s Codex usage limits. Users had stacked up to three banked resets already.'),
  ]);
  assert.equal(snapshot.events[0].type, 'banked');
  assert.equal(snapshot.events[0].status, 'confirmed');
  assert.equal(snapshot.events[1].type, 'regular');
  assert.equal(snapshot.events[1].status, 'confirmed');
  assert.equal(snapshot.warnings.length, 1);
});

test('future dated records cannot become confirmed, even when supplied as latest', () => {
  const record = raw('1', 'We have reset usage limits for all users.', { announced_at: at(1) });
  const result = normalize([record], status(record));
  assert.equal(result.events[0].status, 'unverified');
  assert.equal(forecastReset(result.events, NOW).reason, 'no-confirmed-events');
});

test('source and timestamp validation rejects bad or empty snapshots', () => {
  assert.throws(() => normalize([]), /Empty history/);
  assert.throws(() => normalize([raw('1', 'Hi', { reset_type: 'maybe' })]), /Unknown reset type/);
  assert.throws(() => normalize([raw('1', 'Hi', { announced_at: 'yesterday' })]), /timestamp/);
  assert.throws(() => normalize([raw('1', 'Hi', { announced_at: '2026-02-30T12:00:00Z' })]), /timestamp/);
  assert.throws(() => normalize([raw('1', 'Hi', { source: { type: 'x_post', url: 'javascript:alert(1)' } })]), /URL/);
  assert.throws(() => normalize([raw('1', 'Hi', { source: { type: 'x_post', url: 'https://example.com/pretend-source' } })]), /URL/);
  assert.throws(() => normalizeSnapshot({ status: status(), history: envelope([raw()]), fetchedAt: at(1) }, NOW), /future/);
  assert.throws(() => validateSnapshot({}), /schema/);
});

test('complete pagination and oldest source generation determine freshness', () => {
  const one = envelope([raw('1')], true, 'abc');
  const two = envelope([raw('2')]); two.meta.generated_at = at(-4);
  const result = normalizeSnapshot({ status: status(), history: [one, two], fetchedAt: NOW }, NOW);
  assert.equal(result.historyComplete, true);
  assert.equal(result.generatedAt, at(-4));
  assert.equal(normalize([raw()], status(), true).historyComplete, false);
  assert.throws(() => normalizeSnapshot({ status: status(), history: [two, one], fetchedAt: NOW }, NOW), /Unexpected page/);
});

test('duplicate ids, sources and round ids merge while preserving stronger completion', () => {
  const record = raw('1', 'A reset will land in the next hour.');
  const completed = raw('2', 'We have reset usage limits for all paid users.', { source: record.source });
  const sameRound = raw('3', 'A reset will land in the next hour.', { round_id: record.source.url });
  const result = normalize([record, completed, sameRound]);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].status, 'confirmed');
});

test('conditional frequency uses strict lower and inclusive upper boundaries', () => {
  // Current elapsed t=24h; completed intervals 24,48,72,96,120,144h.
  const events = [event(1, -528), event(2, -504), event(3, -456), event(4, -384), event(5, -288), event(6, -168), event(7, -24)];
  const result = forecastReset(events, NOW, 48);
  assert.equal(result.intervalCount, 6);
  assert.equal(result.eligibleIntervals, 5);
  assert.equal(result.matchedIntervals, 2);
  assert.equal(result.percent, 40);
  assert.equal(result.reason, 'available');
});

test('small samples, no events and long elapsed zero samples suppress percentages', () => {
  assert.equal(forecastReset([], NOW).reason, 'no-confirmed-events');
  const small = forecastReset([event(1, -72), event(2, -24)], NOW);
  assert.equal(small.eligibleIntervals, 1);
  assert.equal(small.percent, null);
  assert.equal(small.reason, 'insufficient-samples');
  const none = forecastReset([event(1, -300), event(2, -290)], NOW);
  assert.equal(none.eligibleIntervals, 0);
  assert.equal(none.percent, null);
});

test('uncertain regular announcements break intervals, while banked credits do not', () => {
  const base = [event(1, -96), event(2, -48, { status: 'announced', confirmationBasis: 'none' }), event(3, -24)];
  assert.equal(forecastReset(base, NOW).intervalCount, 0);
  assert.equal(forecastReset([base[0], { ...base[1], type: 'banked' }, base[2]], NOW).intervalCount, 1);
  assert.equal(forecastReset([base[0], base[1]], NOW).reason, 'unverified-events');
});

test('unknown scopes are excluded and break intervals; all-plans may cover paid plans', () => {
  const records = [event(1, -120, { scope: 'all-plans' }), event(2, -60), event(3, -24, { scope: 'unspecified' })];
  const result = forecastReset(records, NOW);
  assert.equal(result.intervalCount, 1);
  assert.equal(result.lastResetAt, at(-60));
  assert.equal(result.reason, 'unverified-events');
  assert.equal(result.percent, null);
  assert.equal(forecastReset(records, NOW, 48, { scope: 'all-plans' }).intervalCount, 0);
  const restricted = normalize([raw('10', 'We have reset rate limits for Plus & Pro subscriptions.')]);
  assert.equal(restricted.events[0].scope, 'unspecified');
});

test('future samples, duplicate rounds, zero-length intervals do not inflate samples', () => {
  const records = [event(1, -72), event(2, -24), event(3, -24, { roundId: '2' }), event(4, 10)];
  assert.equal(forecastReset(records, NOW).intervalCount, 1);
  assert.equal(forecastReset([event(1, -24), event(2, -24)], NOW).intervalCount, 0);
});

test('stale and incomplete history withhold output even when five clean samples exist', () => {
  const records = Array.from({ length: 7 }, (_, index) => event(index + 1, -24 - index * 72));
  assert.equal(forecastReset(records, NOW).percent, 100);
  assert.equal(forecastReset(records, NOW, 48, { generatedAt: at(-24) }).reason, 'available');
  const stale = forecastReset(records, NOW, 48, { generatedAt: at(-24.001) });
  assert.equal(stale.percent, null); assert.equal(stale.reason, 'stale-data');
  const partial = forecastReset(records, NOW, 48, { historyComplete: false });
  assert.equal(partial.percent, null); assert.equal(partial.reason, 'incomplete-history');
  assert.throws(() => forecastReset(records, NOW, 0), /Invalid/);
});

test('watch forecast score is never promoted into a probability', () => {
  const result = normalize([raw()], status(null, { active_watch: { level: 'elevated', observed_at: at(-2), expires_at: at(20), reset_chance_percent: 95, forecast_window: '48h', source: { url: 'https://x.com/thsottiaux/status/999' } } }));
  assert.equal(result.watch.level, 'elevated');
  assert.equal('reset_chance_percent' in result.watch, false);
  assert.ok(result.watch.summary.includes('not a commitment'));
});

test('public fetch follows cursors and preserves provider generation time', async () => {
  const endpoints = [];
  const payloads = [status(), envelope([raw('1')], true, 'cursor +/?'), envelope([raw('2')])];
  const result = await fetchResetSnapshot({ now: NOW, fetchImpl: async (endpoint) => { endpoints.push(endpoint); return Response.json(payloads.shift()); } });
  assert.equal(result.events.length, 2);
  assert.equal(result.generatedAt, at(-1));
  assert.equal(new URL(endpoints[2]).searchParams.get('cursor'), 'cursor +/?');
  assert.ok(endpoints.every((endpoint) => endpoint.startsWith('https://codex-resets.com/api/v1/')));
});

test('429 stops without retry and exposes Retry-After; bad pagination cannot loop', async () => {
  let calls = 0;
  await assert.rejects(fetchResetSnapshot({ now: NOW, fetchImpl: async () => { calls++; return new Response('', { status: 429, headers: { 'Retry-After': '600' } }); } }), (error) => error.status === 429 && error.retryAfter === '600');
  assert.equal(calls, 1);
  const payloads = [status(), envelope([raw('1')], true, 'repeat'), envelope([raw('2')], true, 'repeat')];
  await assert.rejects(fetchResetSnapshot({ now: NOW, fetchImpl: async () => Response.json(payloads.shift()) }), /pagination/);
});

test('public scope still excludes banked credits and later unconfirmed records block output', () => {
  const records = Array.from({ length: 7 }, (_, index) => event(index + 1, -24 - index * 72, { scope: 'unspecified' }));
  const options = { scope: 'public-reset-events' };
  const baseline = forecastReset(records, NOW, 48, options);
  assert.equal(baseline.eligibleIntervals, 6);
  assert.equal(baseline.percent, 100);
  const banked = event(99, -4, { type: 'banked' });
  assert.deepEqual(forecastReset([...records, banked], NOW, 48, options), baseline);
  const pending = event(100, -2, { status: 'announced', confirmationBasis: 'none' });
  const uncertain = forecastReset([...records, pending], NOW, 48, options);
  assert.equal(uncertain.reason, 'unverified-events');
  assert.equal(uncertain.percent, null);
  const inBetween = event(101, -50, { status: 'unverified', confirmationBasis: 'none' });
  assert.equal(forecastReset([...records, inBetween], NOW, 48, options).intervalCount, 5);
});

test('public scope recomputes its survivor sample as time elapses and retains stale gates', () => {
  const records = [event(1, -528), event(2, -504), event(3, -456), event(4, -384), event(5, -288), event(6, -168), event(7, -24)];
  const options = { scope: 'public-reset-events' };
  const early = forecastReset(records, at(-1), 48, options);
  assert.equal(early.eligibleIntervals, 6);
  assert.equal(early.matchedIntervals, 2);
  const later = forecastReset(records, NOW, 48, options);
  assert.equal(later.eligibleIntervals, 5);
  assert.equal(later.matchedIntervals, 2);
  assert.equal(later.percent, 40);
  assert.equal(forecastReset(records, NOW, 48, { ...options, generatedAt: at(-25) }).reason, 'stale-data');
  assert.equal(forecastReset(records, NOW, 48, { ...options, historyComplete: false }).reason, 'incomplete-history');
});

test('synthetic snapshot validation retains provenance without a real data dump', () => {
  const data=normalize([raw('1')]);
  assert.equal(validateSnapshot(data).events[0].confirmationBasis,'completion-wording');
  assert.equal(data.rawEventCount,1);
  assert.equal(data.historyComplete,true);
});
test('synthetic public-event example reports frequency independently of plan eligibility', () => {
  const rows=[-528,-504,-456,-384,-288,-168,-24].map((hours,i)=>event(i+1,hours,{scope:'unspecified',sourceKind:'observed',sourceUrl:`https://example.com/synthetic/${i+1}`}));
  const options={scope:'public-reset-events',generatedAt:at(-1),historyComplete:true};
  const report=forecastReset(rows,NOW,48,options);
  assert.equal(report.eligibleIntervals,5); assert.equal(report.matchedIntervals,2); assert.equal(report.percent,40);
  assert.equal(forecastReset(rows,NOW).percent,null);
});
