# Benchmarks

This file keeps the current benchmark baseline in a human-readable form.
Raw run outputs live under `load/results/` and are intentionally gitignored.

## Current Baseline

Clean run captured on `2026-03-20` from:
- `load/results/20260320-123046`
- `load/results/observability-20260320-123345`

### Mixed Workload

- Throughput: `247.59 req/s`
- HTTP requests: `10018`
- Average latency: `70.52 ms`
- P95 latency: `131.33 ms`
- Failure rate: `0%`

### Ingest

- HTTP requests: `2649`
- Average latency: `53.95 ms`
- P95 latency: `118.93 ms`
- Failure rate: `0%`

### Dashboard Step

- HTTP requests: `939`
- Average latency: `45.08 ms`
- P95 latency: `110.98 ms`
- Failure rate: `0%`

## Server-side Observability

- nginx route mix was clean for the monitored run, with the hot paths returning `200`:
  - `/api/query`
  - `/api/quality`
  - `/api/schemas`
  - `/api/segments`
- The only non-`200` responses in the access log were one redirect and a small number of static asset `404`s, not API failures.
- `pg_stat_statements` shows the expected top queries:
  - Query Explorer grouped `date_trunc(...)` event counts
  - `events` inserts
  - profile and attribute-history upserts

## Notes

- Older local benchmark folders were intentionally retired after earlier runs were affected by invalid test payloads and an interrupted local runner.
- Use this run as the baseline for the next tuning pass unless a new clean benchmark replaces it.
