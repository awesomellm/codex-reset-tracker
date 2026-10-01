# Codex Reset Tracker core

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [繁體中文](README.zh-HK.md)

Reusable JavaScript for normalizing public reset announcements, keeping source provenance, separating regular quota resets from banked credits, and describing historical interval frequency. This repository contains no account access, private usage data or live historical data dump.

## Run locally

Node.js 20 or newer, no dependencies:

```sh
git clone https://github.com/awesomellm/codex-reset-tracker.git
cd codex-reset-tracker
node --test reset.test.mjs
node example.mjs en
```

The example uses seven invented events and a fixed reference time. It performs no network request. Two of five surviving intervals match the next 48-hour window, giving a descriptive 40% frequency. The example is not a current announcement, a forecast for a specific account or a calibrated probability.

## Modules

- `normalizeSnapshot`: validate feed records, timestamps and sources, then classify conservative event states.
- `validateSnapshot`: validate normalized snapshots without refreshing their original data age.
- `forecastReset`: filter adjacent eligible events and return counts, percentage or a reason for withholding it.
- `fetchResetSnapshot`: optional public-feed retrieval with cursor pagination, oldest-generation freshness and bounded rate-limit handling. Importing the module or running the example does not fetch.

[Method and limits](METHOD.md) explain scope, sample gates and the conditional formula. [Type declarations](codex-reset.d.mts) describe the shared API. Code identifiers, classification reasons and technical source records use English; documentation and example explanations have four independent language versions.

The test suite retains synthetic classification, pagination, uncertainty, duplicate and numerical checks from the implementation. Two tests tied to the site's real historical data are replaced by synthetic provenance and public-scope tests.

See the [English online tracker](https://zequnweb.com/tools/codex-reset-tracker/) or [ZequnWeb](https://zequnweb.com/). The software uses the MIT license (`LICENSE`). A third-party feed's data and service terms are separate from this code license.
