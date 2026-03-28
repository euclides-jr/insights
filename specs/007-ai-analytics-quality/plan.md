# Implementation Plan: AI Analytics Quality Improvements

**Branch**: `007-ai-analytics-quality` | **Date**: 2026-03-28 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/007-ai-analytics-quality/spec.md`

---

## Summary

Improve AI analytics quality and trust by expanding prompt date-range interpretation, adding a low-confidence clarification path, exposing a compact execution summary, improving empty-result recovery guidance, and refreshing seeded demo data to better support the documented example prompts.

The date-range work in this plan uses a hybrid parser strategy:

- deterministic parsing and normalization first for supported phrases
- a bounded structured LLM fallback only when deterministic parsing cannot safely resolve the range
- clarification when neither path can produce a trustworthy result

Current status: implemented in the repo. The shipped work covers hybrid date parsing, clarification for ambiguous prompt/event matches, execution-summary transparency, deterministic zero-result recovery suggestions, and live-seed verification for the documented prompt set.

---

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js / Bun, React 19, Next.js 16.x  
**Primary Dependencies**: Existing Vercel AI SDK integration, Zod, Prisma 7.x, Playwright, Vitest, and a deterministic NLP date parser such as `chrono-node`  
**Storage**: No new tables; reuse existing event schemas and seeded event data  
**Testing**: Vitest for parser/service logic and Playwright for AI panel flows  
**Target Platform**: Existing `/query` AI analytics UI and `app/api/ai/*` routes  
**Constraints**: No new auth flow, no persistent AI storage, no database schema migration required  
**Scope**: Quality improvements to the existing AI analytics loop, not a new analytics product surface

---

## Constitution Check

*No `constitution.md` found — no project-level gates to evaluate. Standard engineering best practices apply.*

| Gate | Status | Notes |
|------|--------|-------|
| No new auth mechanism | ✅ PASS | Builds on the existing dashboard session model |
| No new database tables | ✅ PASS | Uses UI state, heuristics, and refreshed seed content only |
| Safe error handling | ✅ PASS | Clarification and summary flows remain user-safe and avoid raw model output |
| Testable increments | ✅ PASS | Each story can be validated with targeted unit/e2e coverage |

---

## Project Structure

### Documentation (this feature)

```text
specs/007-ai-analytics-quality/
├── spec.md
├── plan.md
└── tasks.md
```

### Expected Source Code Touchpoints

```text
components/ai/
├── ai-analytics-panel.tsx
├── ai-query-inspector.tsx
└── ai-explanation.tsx

lib/
├── ai/
│   └── date-range.ts
└── services/
    └── ai-analytics.ts

prisma/
└── seed.ts

docs/
└── AI_PROMPT_EXAMPLES.md

tests/
├── unit/
│   ├── ai-date-range.test.ts
│   └── ai-analytics.test.ts
└── e2e/
    └── ai-analytics.spec.ts
```

---

## Delivery Strategy

### Slice 1: Hybrid Date Parsing (MVP)

- add a deterministic NLP-backed date parser and normalization layer for common analytics phrasing
- add a structured LLM fallback interface for unresolved or ambiguous date ranges
- surface interpreted date range in the UI
- add unit and e2e coverage for supported phrases

### Slice 2: Confidence and Clarification

- add heuristic confidence scoring for event/property choice
- add a clarification state when confidence is low
- add tests for ambiguous prompts

### Slice 3: Trust and Recovery

- add execution summary content
- improve zero-result explanations and recovery hints
- add non-empty seeded coverage for key prompt examples

### Delivered Outcome

- `lib/ai/date-range.ts` and `lib/ai/date-range-server.ts` now provide the hybrid parser path
- `/api/ai/generate` resolves dates server-side, returns resolved-range metadata, and can return clarification options
- `components/ai/ai-analytics-panel.tsx` renders clarification, execution summary, and seeded-run results
- `components/ai/ai-query-inspector.tsx` shows date source and confidence
- `components/ai/ai-explanation.tsx` renders deterministic recovery suggestions for zero-result runs
- `tests/unit/ai-date-range.test.ts`, `tests/unit/ai-analytics.test.ts`, and `tests/e2e/ai-analytics.spec.ts` cover the delivered flows
- `docs/AI_PROMPT_EXAMPLES.md` is aligned with the verified seeded prompt windows

---

## Story-to-Implementation Mapping

| Story | Primary Files |
|------|---------------|
| US1 Rich time ranges | `lib/ai/date-range.ts`, `lib/services/ai-analytics.ts`, `components/ai/ai-analytics-panel.tsx`, tests |
| US2 Clarification | `lib/services/ai-analytics.ts`, `components/ai/ai-analytics-panel.tsx`, tests |
| US3 Transparency | `components/ai/ai-analytics-panel.tsx`, `components/ai/ai-query-inspector.tsx` |
| US4 Empty-result recovery | `lib/services/ai-analytics.ts`, `components/ai/ai-explanation.tsx`, tests |
| US5 Seeded demo coverage | `prisma/seed.ts`, `docs/AI_PROMPT_EXAMPLES.md`, tests |

---

## Risks

- Clarification adds UI complexity to what is currently a single-submit flow.
- More aggressive date parsing can introduce incorrect interpretation if normalization rules are too loose or if fallback boundaries are not explicit.
- Adding an LLM fallback for date parsing can increase latency and cost if the deterministic parser does not cover the common path well enough.
- Seed refreshes can accidentally break existing screenshot/demo expectations if not validated against example prompts.

---

## Validation Plan

- Unit tests for deterministic date parsing, fallback routing, and confidence/clarification heuristics
- Playwright tests for:
  - rich time-range prompts
  - deterministic-parser and LLM-fallback surfaced ranges
  - clarification flow
  - execution summary visibility
  - empty-result recovery guidance
- live-seed Playwright verification against the documented prompt examples for all seeded applications

## Residual Gaps

- no dedicated clarification flow yet for ambiguous property filters or aggregation field selection
- recovery suggestions are deterministic and generic rather than ranked against neighboring schemas
- manual reseed walkthrough notes are still lightweight compared with the automated seeded verification now in place
