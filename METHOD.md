# Public events and conditional interval frequency

[English](METHOD.md) | [简体中文](METHOD.zh-CN.md) | [日本語](METHOD.ja.md) | [繁體中文](METHOD.zh-HK.md)

## Define the measured event

`public-reset-events` means the arrival of publicly reported, completed regular reset events. It does not say that a particular account received extra usage. `paid-plans` and `all-plans` additionally require explicit scope in the supplied record. Unspecified scope stays unknown. Banked credits are separate and never enter regular-reset interval statistics.

`confirmed` is a classifier state: the feed reports a latest completed event or the supplied text reports completion. It is not independent verification of the original post or anyone's account. Scheduled, future and vague announcements remain conservative. The wording rules recognize specific English phrases rather than arbitrary natural language; translating the report does not make the classifier multilingual.

## Compute adjacent intervals

Deduplicate ids, source URLs and round ids, order events by time, and use only adjacent eligible regular events. An uncertain or ineligible regular event breaks the chain; do not turn missing certainty into an artificially long interval.

Let `D` be each historical completed interval in hours, `t` the hours elapsed since the latest eligible event, and `w` the next window:

```text
survivors = count(D > t)
matches   = count(t < D <= t + w)
frequency = 100 * matches / survivors
```

The lower bound is strict; the upper bound is inclusive. The synthetic example has intervals 24,48,72,96,120,144 hours, elapsed time 24 and window 48. Five intervals survive; 48 and 72 match, so the result is 40%. After more time passes, recompute the survivor set. The historical schedule is not a stationary model and this frequency is not calibrated for future outcomes.

## Withhold an unsupported percentage

At least five surviving intervals are required. No completed event, a later uncertain regular event, incomplete feed pagination, or source data older than the allowed age suppresses the percentage. Default maximum age is 24 hours; future source generation beyond the clock tolerance also stops output. Display the reason and counts instead of changing `null` to zero.

Production callers must pass actual `generatedAt` and `historyComplete`. Omitting those options skips the freshness and completeness gates; it is appropriate for a controlled synthetic example, not a claim that live input is fresh. Retrying a stale snapshot does not refresh its generation time.

## Optional retrieval

`fetchResetSnapshot` reads a third-party public API configured by `RESET_API_BASE`; it does not authenticate to Codex or read usage limits. It follows every cursor, rejects repeated or absent required cursors, retains the oldest page generation time, and exposes a 429 response with `Retry-After` without a tight retry. Tests inject a fake fetch implementation.

Before connecting a feed, assess provenance, permission to reuse data, service availability and schema. A feed's complete pagination does not prove all real events were captured. Keep source URLs, fetch time, generation time, scope and confirmation basis in the record. Show stale or missing coverage clearly. Review and test classifier changes before using a new wording format.
