# Feature Specification: AI-Assisted Analytics

**Feature Branch**: `006-ai-assisted-analytics`  
**Created**: 2026-03-28  
**Status**: Draft  
**Input**: User description: "by given a prompt a LLM should generate queries for the query explorer based on the event schemas available, it should run the query and explain the results"

## Summary

Users currently need to know the exact event names, property keys, aggregation modes, and filter operators to construct a useful query in the Query Explorer. This creates friction for less technical users and slows down exploratory analytics.

This feature adds an AI-assisted analytics panel that accepts a plain-language question from the user, automatically translates it into a valid query against the available event schemas for the selected application, executes that query, and then presents a natural-language explanation of the results alongside the data.

This feature intentionally does **not** replace the manual Query Explorer form, add persistent AI conversation history, or support free-form SQL generation. The AI layer is a query generation and explanation surface on top of the existing query engine.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Natural-Language Query Generation (Priority: P1)

A product manager wants to know "how many signups happened last week, broken down by plan?" but does not know the event name or property keys needed to answer that. They type the question into an AI analytics panel, and the system produces and runs the correct query against the `signup` event schema.

**Why this priority**: This is the core capability. Without query generation, the rest of the feature has no value. It is the smallest slice that delivers the full user promise.

**Independent Test**: Submit a plain-language question with an application selected, verify the system generates a syntactically valid query matching the event schema for that application, and confirm query results are returned in the results panel.

**Acceptance Scenarios**:

1. **Given** the user selects an application with at least one active event schema, **When** they type a plain-language analytics question and submit, **Then** the system generates a query that references an event name and properties drawn only from that application's schemas.
2. **Given** the generated query is valid, **When** the system executes it, **Then** the results are displayed in the same results panel used by the manual Query Explorer.
3. **Given** no event schemas exist for the selected application, **When** the user submits a question, **Then** the system shows a clear message explaining there are no schemas to query and no query is attempted.
4. **Given** the user has not selected an application, **When** they attempt to submit a question, **Then** the submit action is disabled until an application is chosen.

---

### User Story 2 - Results Explanation (Priority: P1)

A user receives query results for their question but is unsure what the numbers mean or whether the result answered their question well. The system provides a short plain-language explanation of the results alongside the data.

**Why this priority**: Raw numbers without interpretation are hard to act on. This is a first-class part of the stated feature goal ("explain the results") and can be built independently of advanced generation logic.

**Independent Test**: After a query runs successfully, verify a non-empty explanation paragraph is shown beneath the results. The explanation must reference the result shape (e.g., noting if results are empty, listing the top value, or summarising a trend).

**Acceptance Scenarios**:

1. **Given** a query has run and returned at least one result row, **When** results are displayed, **Then** a concise explanation in plain language is shown below or alongside the data.
2. **Given** a query runs and returns zero rows, **When** results are displayed, **Then** the explanation notes that no matching events were found and suggests possible reasons.
3. **Given** results contain time-bucketed data, **When** the explanation is generated, **Then** it describes any notable trend visible in the series.

---

### User Story 3 - Inspect and Refine the Generated Query (Priority: P2)

A technical analyst wants to see exactly what query the AI produced before trusting the results. They can view the generated query definition, understand whether it mapped their question correctly, and optionally open it in the full Query Explorer form for manual refinement.

**Why this priority**: Trust and transparency are important in analytics. Users need to know what was queried. This story does not block the core value but substantially increases adoption among power users.

**Independent Test**: After submitting a question, verify the generated query parameters (event name, filters, aggregation, date range) are visible in an expandable or dedicated inspection area. Verify an action to load those parameters into the manual Query Explorer form is available and works.

**Acceptance Scenarios**:

1. **Given** the system has generated and run a query, **When** the user inspects the generated query, **Then** the event name, date range, aggregation, and any applied filters are shown in a readable format.
2. **Given** the generated query is visible, **When** the user chooses to open it in the Query Explorer form, **Then** the Query Explorer form is populated with the generated parameters.
3. **Given** a query produces results the user wants to refine, **When** they modify it manually in the Query Explorer, **Then** the changes run as a normal manual query.

---

### User Story 4 - Question History Within Session (Priority: P3)

A user asks several analytics questions in one session and wants to revisit an earlier result without re-typing the question or re-running the query.

**Why this priority**: Session history reduces friction in exploratory workflows. It is independent of generation and explanation and can be added after the core loop is working.

**Independent Test**: Submit at least three different questions in sequence, verify all three appear in a visible history panel, and confirm clicking a prior entry restores its question text, generated query, and results.

**Acceptance Scenarios**:

1. **Given** the user has submitted multiple questions in the current session, **When** they view the history panel, **Then** all submitted questions are listed in reverse chronological order.
2. **Given** the user clicks a history entry, **When** it is restored, **Then** the original question text, generated query, and results are displayed exactly as they were when first run.
3. **Given** the user submits a new question, **When** history is viewed, **Then** the new question appears at the top of the list.

---

### Edge Cases

- What happens when the AI model is unavailable or returns a malformed response? The system must show a user-friendly error and not expose raw error payloads.
- What happens when the generated query references a property key that does not exist in the schema? The system must surface a validation error from the query engine rather than returning incorrect results.
- What happens when the question is too vague or ambiguous to map to a query? The system must explain what information is missing and invite the user to clarify.
- What happens when the prompt contains very large text (e.g., pasted data)? Input MUST be bounded to prevent excessive request sizes.
- What happens when the query execution returns an error (e.g., invalid date range)? The explanation phase MUST be skipped and the query error shown clearly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The AI analytics panel MUST allow users to type a plain-language question and submit it for query generation.
- **FR-002**: The system MUST require an application to be selected before a question can be submitted.
- **FR-003**: The system MUST retrieve all active event schemas for the selected application and provide them as context for query generation.
- **FR-004**: The system MUST generate a query definition that is compatible with the existing query engine and references only event names and property keys present in the application's schemas.
- **FR-005**: The system MUST execute the generated query through the existing query engine and display results in the standard results panel.
- **FR-006**: The system MUST generate a plain-language explanation of the query results and display it alongside the data.
- **FR-007**: The explanation MUST specifically address the case of zero results and offer a contextual suggestion.
- **FR-008**: The generated query definition MUST be inspectable by the user in a structured, readable format.
- **FR-009**: Users MUST be able to load the generated query into the manual Query Explorer form for further refinement.
- **FR-010**: The system MUST handle AI model errors gracefully, displaying a user-friendly message without exposing internal error details.
- **FR-011**: User question input MUST be bounded to a maximum length to prevent abuse.
- **FR-012**: The system MUST display a loading indicator while query generation and execution are in progress.
- **FR-013**: The AI analytics panel MUST be accessible from the Query Explorer page.

### Non-Functional Requirements

- **NFR-001**: End-to-end latency from question submission to results displayed MUST be communicated to the user via visible progress feedback throughout.
- **NFR-002**: Query generation MUST produce a valid, executable query or return an error; it MUST NOT silently produce incorrect queries.
- **NFR-003**: The feature MUST work within the existing dashboard authentication model without requiring additional credentials from users.

### Key Entities

- **AIAnalyticsRequest**: A user's plain-language question paired with the selected application identifier and a default date range, submitted to the AI query generation service.
- **GeneratedQuery**: The structured query definition produced by the AI, conforming to the existing QueryDefinition schema, traceable back to the originating question.
- **AIResultExplanation**: A natural-language summary of the query result set, produced by the AI after query execution, contextually tied to the original question and the results returned.
- **EventSchemaContext**: The set of active event schemas for the selected application, including event names and typed property definitions, provided to the AI as grounding context.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can receive query results for a plain-language analytics question in under 30 seconds from submission.
- **SC-002**: At least 80% of questions referencing a single event type and a property from the available schemas produce a valid, executable query on the first attempt.
- **SC-003**: 100% of successful query runs produce a non-empty explanation visible to the user without additional interaction.
- **SC-004**: Users can load a generated query into the manual Query Explorer in one action, with no configuration loss.
- **SC-005**: AI model or query execution errors result in a user-visible message in 100% of failure cases, with no unhandled exceptions surfaced to the user.

## Out of Scope

- Persistent AI conversation history across browser sessions or user accounts
- Free-form SQL generation or arbitrary query language beyond the existing query engine
- Multi-application or cross-workspace queries
- Scheduled or automated AI-generated reports
- Fine-tuning or self-hosted AI model deployment
- Replacement of the manual Query Explorer form
