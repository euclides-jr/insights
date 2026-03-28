# Feature Specification: AI Analytics Quality Improvements

**Feature Branch**: `007-ai-analytics-quality`  
**Created**: 2026-03-28  
**Status**: Implemented  
**Input**: Follow-up improvement request for AI analytics accuracy, transparency, and seeded-demo usefulness

## Summary

The current AI analytics flow is implemented and usable, but it still relies on lightweight prompt date parsing, best-effort schema matching, and opaque execution assumptions. This causes avoidable failures in realistic prompts such as:

- natural-language time ranges not being interpreted richly enough
- ambiguous prompts producing a guessed query instead of a clarification path
- correct-but-empty results feeling broken because the system does not explain whether the issue is the data window, event choice, or property mapping
- demo prompts failing against seeded applications because the seeded data is not recent or varied enough for common questions

This feature improves the quality and trustworthiness of AI analytics by making date interpretation more capable, schema grounding more explicit, query assumptions more visible, and seeded demo data more representative.

Date interpretation in this feature follows a hybrid parser strategy:

- deterministic natural-language parsing and normalization is the primary path for supported phrases
- a strict structured LLM fallback is used only when deterministic parsing is missing, incomplete, or ambiguous
- a clarification path is used when neither parser can safely resolve the requested window

This feature intentionally does **not** add a persistent chatbot, free-form SQL, cross-application analytics, or model fine-tuning. The goal is to make the existing AI analytics loop more accurate, debuggable, and reliable.

## Current Implementation Snapshot

Implemented today:

1. AI analytics panel on `/query`
2. Schema-grounded query generation against active event schemas
3. Property-description-aware query refinement
4. Hybrid date-range resolution with deterministic parsing first and structured LLM fallback second
5. Prompt-derived date ranges for quantified windows, `today`, `yesterday`, `last month`, `year to date`, `between X and Y`, `since X`, named months, and quarters
6. Clarification flow for ambiguous event matches and unresolved time windows
7. Execution summary, query inspector, and in-session history
8. Deterministic zero-result recovery suggestions rendered in the UI
9. Prompt examples and live-seed verification for one documented prompt per seeded application

Known gaps:

1. The date parser still handles a targeted analytics phrase set, not arbitrary calendar language like fiscal periods or highly implicit ranges
2. Clarification currently focuses on ambiguous event selection and unresolved date windows, not yet ambiguous property/filter selection
3. Recovery suggestions are rule-based and useful, but they do not yet propose neighboring schema-backed events automatically

## Implementation Status

Delivered in the current repo state:

- US1 Rich natural-language time ranges: implemented
- US2 Clarification instead of unsafe guessing: implemented for low-confidence event matches and unresolved date windows
- US3 Query assumption transparency: implemented through execution summary and query inspector date-source metadata
- US4 Better empty-result recovery: implemented through deterministic recovery suggestions in the AI summary panel
- US5 Better seeded demo coverage: implemented through prompt-doc alignment and Playwright verification against the live seeded database

## User Story 1 - Rich Natural-Language Time Ranges (Priority: P1)

A user asks questions like "Show mobile subscriptions by billing period for the last month", "Revenue since January", or "Page views between March 1 and March 15" and expects the executed query window to match the wording without needing manual date edits.

**Why this priority**: Date interpretation is a primary source of incorrect or empty results. If the time window is wrong, the rest of the AI flow can be technically correct but practically useless.

**Independent Test**: Submit prompts with multiple supported natural-language time expressions and verify the generated query inspector shows the expected resolved date range.

### Acceptance Scenarios

1. **Given** a prompt that contains `last month`, **When** the query is generated, **Then** the executed date range covers the prior 30 days rather than the default 7 days.
2. **Given** a prompt that contains `between March 1 and March 15`, **When** the query is generated, **Then** the query uses that exact interpreted range.
3. **Given** a prompt that contains `year to date`, **When** the query is generated, **Then** the start date resolves to January 1 of the current year.

## User Story 2 - Clarification Instead of Unsafe Guessing (Priority: P1)

A user asks an ambiguous question such as "Show conversions by source" when multiple events or properties could plausibly match. The system should avoid silently guessing when confidence is low and instead ask the user to clarify the intended event or grouping.

**Why this priority**: Wrong answers with confident wording are more harmful than explicit uncertainty. This is the biggest trust gap in the current AI flow.

**Independent Test**: Submit prompts that could match multiple event schemas and verify the UI enters a clarification state instead of running a guessed query.

### Acceptance Scenarios

1. **Given** a prompt that could map to multiple events with similar relevance, **When** no clear winner exists, **Then** the user is shown a clarification prompt instead of executed results.
2. **Given** a clarification choice is shown, **When** the user selects one option, **Then** the system generates and runs a query using that selection.
3. **Given** a prompt clearly matches one event and property, **When** the AI flow runs, **Then** no clarification step is inserted.

## User Story 3 - Query Assumption Transparency (Priority: P2)

A user wants to understand why the AI chose a particular event, group-by property, and date range before trusting the results.

**Why this priority**: Transparency increases trust, speeds debugging, and makes the feature easier to evaluate during product demos.

**Independent Test**: Submit a prompt and verify the panel shows a compact execution summary describing the interpreted date range, chosen event, chosen grouping, and any fallback assumptions.

### Acceptance Scenarios

1. **Given** a successful query generation, **When** results are shown, **Then** the UI includes a visible execution summary describing the chosen event and interpreted date range.
2. **Given** the system selected a property using schema descriptions rather than an exact key match, **When** the summary is displayed, **Then** it states that interpretation in user-friendly language.
3. **Given** the system used a fallback because the prompt did not fully specify the query, **When** the summary is shown, **Then** the fallback is disclosed.

## User Story 4 - Better Empty-Result Recovery (Priority: P2)

A user receives zero rows and needs to know what to try next instead of only being told that no matching events were found.

**Why this priority**: Empty results are common in analytics, especially in demo or seeded environments. Recovery guidance makes the feature much more usable.

**Independent Test**: Submit a prompt that correctly maps to a seeded event but produces zero rows because of the interpreted date window, and verify the UI suggests a broader date range or adjacent schema-backed alternatives.

### Acceptance Scenarios

1. **Given** the generated query is valid but returns zero rows, **When** the explanation is shown, **Then** it suggests at least one concrete recovery action grounded in the schema or time range.
2. **Given** the selected application has older seeded data than the interpreted range, **When** zero rows are returned, **Then** the recovery guidance suggests broadening the time window.
3. **Given** a grouped query returns zero rows, **When** the guidance is shown, **Then** it does not imply the property is invalid if it exists in the schema.

## User Story 5 - Better Seeded Demo Coverage (Priority: P3)

A developer or reviewer uses the seeded applications to test AI analytics and expects common prompts in the examples doc to return meaningful results without manual seed tweaking.

**Why this priority**: Demo friction makes the feature feel less reliable than it is. Improving the seeded dataset has high leverage for onboarding, screenshots, and QA.

**Independent Test**: Reseed the database, run the documented example prompts for each seeded application, and verify that the highlighted prompts produce non-empty results within their described windows.

### Acceptance Scenarios

1. **Given** the database is freshly seeded, **When** the documented mobile subscription example for the last month is run, **Then** grouped results are returned.
2. **Given** the documented web and admin prompt examples are used, **When** they are executed against fresh seed data, **Then** the example set has meaningful non-empty coverage across all seeded applications.
3. **Given** seeded schemas are updated, **When** prompt examples are reviewed, **Then** the examples remain aligned with the current data and property descriptions.

## Requirements

### Functional Requirements

- **FR-001**: The AI analytics flow MUST support more natural-language time expressions than the current minimal set, including bounded ranges and calendar-relative phrases.
- **FR-001a**: Natural-language time parsing MUST use a deterministic parser and normalization layer as the primary resolution path for supported phrases.
- **FR-001b**: The system MUST only invoke an LLM date-range parser as a fallback when deterministic parsing is missing, incomplete, or ambiguous.
- **FR-001c**: The LLM date-range fallback MUST return a strict structured result that includes resolved dates or an explicit clarification signal rather than free-form text.
- **FR-001d**: If both deterministic and LLM fallback parsing fail to produce a safe interpretation, the system MUST request clarification instead of silently defaulting to an incorrect range.
- **FR-002**: The system MUST expose the interpreted date range used for execution in the UI.
- **FR-003**: The system MUST avoid executing a guessed query when event or grouping confidence is below a defined threshold.
- **FR-004**: When query confidence is low, the system MUST present a clarification UI with schema-grounded options.
- **FR-005**: The UI MUST show a concise execution summary describing the chosen event, interpreted date range, and grouping.
- **FR-006**: The execution summary MUST disclose when the system relied on a fallback or description-based property match.
- **FR-007**: Empty-result explanations MUST provide at least one concrete recovery suggestion.
- **FR-008**: Seed data for documented AI example prompts MUST include meaningful recent coverage for each seeded application.
- **FR-009**: The seeded prompt examples document MUST stay aligned with the seeded schemas and data windows.

### Non-Functional Requirements

- **NFR-001**: Added date-range interpretation and clarification logic MUST not increase median AI panel latency by more than 2 seconds.
- **NFR-001a**: The deterministic date parser MUST handle the common supported phrases without a network call.
- **NFR-002**: Clarification and execution-summary text MUST avoid exposing internal scoring details or raw model output.
- **NFR-003**: The feature MUST remain fully usable without persistent client storage or new database tables.
- **NFR-004**: The LLM date fallback MUST be isolated behind a bounded interface so it can be tested and disabled independently of the primary parser.

## Key Entities

- **InterpretedDateRange**: A resolved start/end window derived from the user's question and current time.
- **DateRangeParseResult**: A normalized parser result that captures resolved dates, parser source (`deterministic` or `llm`), confidence, and whether clarification is needed.
- **QueryGenerationConfidence**: An internal score or heuristic bundle representing how strongly the prompt matches a specific event and grouping.
- **ClarificationOption**: A schema-grounded event/property choice presented to the user when confidence is low.
- **ExecutionSummary**: A user-facing explanation of how the system interpreted the question before or alongside the query results.
- **DemoPromptExample**: A curated prompt tied to seeded schemas and seeded data windows for manual verification.

## Success Criteria

- **SC-001**: At least 90% of covered prompts that contain supported natural-language time expressions resolve to the expected query window in automated tests.
- **SC-002**: Ambiguous prompt evals covered by automated tests trigger clarification instead of silent execution in 100% of designed low-confidence cases.
- **SC-003**: 100% of successful AI query runs display an execution summary with resolved event and date-range context.
- **SC-004**: Documented seeded prompt examples for all seeded applications produce non-empty results in regression testing unless explicitly marked as empty-state examples.
- **SC-005**: Empty-result recovery guidance is shown in 100% of zero-row cases covered by automated tests.

## Out of Scope

- Persistent AI chat threads
- Free-form SQL or custom analytics formulas
- Cross-application or workspace-wide AI analytics
- Fine-tuning or custom model training
- Voice input or multimodal prompt input
