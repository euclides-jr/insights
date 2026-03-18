# Feature Specification: User Attributes and Combined Querying

**Feature Branch**: `002-user-attributes`  
**Created**: March 14, 2026  
**Status**: Implemented  
**Input**: User description: "I would like to be able to set attributes to unique users then I can find users by combine user attributes and tracking events"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Set User Attributes (Priority: P1)

An application developer assigns persistent attributes to individual users (e.g., subscription tier, country, signup date, user role). These attributes are stored in user profiles and can be updated as user characteristics change. Unlike event properties that are ephemeral, user attributes persist across sessions and describe who the user is.

**Why this priority**: This is the foundation for user-centric analytics. Without persistent user attributes, all analysis is limited to event-level data. User attributes enable understanding who is performing actions, not just what actions are being performed.

**Independent Test**: Can be fully tested by setting attributes for test users via SDK or API, retrieving the user profile, and verifying that attributes are correctly stored and persist across subsequent requests.

**Acceptance Scenarios**:

1. **Given** a user has been identified in the analytics system, **When** the application sets user attributes (e.g., `{email: "user@example.com", plan: "pro", country: "US"}`), **Then** those attributes are stored in the user's profile
2. **Given** a user profile already has attributes, **When** new attributes are set, **Then** existing attributes are preserved unless explicitly updated
3. **Given** a user attribute has been set, **When** subsequent events are tracked for that user, **Then** the events can be correlated with the user's current attributes
4. **Given** a user attribute needs to be changed (e.g., user upgrades from "free" to "pro"), **When** the attribute is updated, **Then** the new value replaces the old value while maintaining a history of when the change occurred
5. **Given** a user profile is created, **When** reserved system attributes are set (e.g., first_seen, last_seen), **Then** the system automatically tracks these without requiring explicit API calls

---

### User Story 2 - Query Users by Attributes (Priority: P2)

A product manager or analyst queries the system to find users matching specific attribute criteria (e.g., "all users in the US with a pro subscription"). The query returns a list of matching user identifiers and their attribute values.

**Why this priority**: Once attributes are stored, they need to be queryable to enable user segmentation and targeted analysis. This enables answering questions like "How many pro users do we have?" or "Which customers are in Europe?"

**Independent Test**: Can be fully tested by creating users with various attributes, running queries with different filter criteria (single attribute, multiple attributes, range conditions), and verifying that only users matching the criteria are returned.

**Acceptance Scenarios**:

1. **Given** users have attributes like subscription tier and country, **When** an analyst queries for users where `plan = "pro"`, **Then** all users with the pro plan are returned
2. **Given** users have numeric attributes (e.g., account_age_days), **When** a query includes range conditions (e.g., `account_age_days > 30`), **Then** only users meeting the numeric criteria are returned
3. **Given** users have multiple attributes, **When** a query combines multiple conditions (e.g., `plan = "pro" AND country = "US"`), **Then** only users matching all conditions are returned
4. **Given** a query returns thousands of users, **When** the result set is paginated, **Then** users can navigate through pages without missing or duplicating results

---

### User Story 3 - Combine User Attributes with Event Behavior (Priority: P3)

An analyst creates complex queries that combine user attributes with event behavior (e.g., "find all pro users in the US who clicked the checkout button in the last 7 days but didn't complete a purchase"). This enables behavioral segmentation that considers both who the user is and what they've done.

**Why this priority**: This is where the real power of user attributes emerges - the ability to segment users based on both identity characteristics and behavioral patterns. This enables highly targeted analysis and re-engagement campaigns.

**Independent Test**: Can be fully tested by creating users with known attributes, generating specific event patterns for those users, then running combined queries and verifying that only users matching both attribute and behavior criteria are returned.

**Acceptance Scenarios**:

1. **Given** users have attributes and event histories, **When** an analyst queries for users matching both attribute conditions (e.g., `plan = "pro"`) and event behavior (e.g., "clicked checkout in last 7 days"), **Then** only users meeting both criteria are returned
2. **Given** a query combines attributes with event frequency (e.g., "users with 5+ page views"), **When** the query is executed, **Then** event counts are calculated per user and filtered correctly
3. **Given** a query needs to exclude users based on behavior (e.g., "users who did NOT complete purchase"), **When** negative event conditions are specified, **Then** users who performed the excluded event are filtered out
4. **Given** a query spans a time range for events (e.g., "last 30 days"), **When** the query is executed, **Then** only events within the specified time window are considered for the behavioral filter
5. **Given** a combined query needs to check event properties (e.g., "checkout amount > $100"), **When** the query includes both user attributes and event property filters, **Then** all conditions are evaluated correctly

---

### User Story 4 - Track User Attribute History (Priority: P4)

An analyst accesses historical user attribute values to understand how user characteristics changed over time (e.g., when did a user upgrade to pro? how long were they on the free tier?). The system maintains a changelog of attribute updates.

**Why this priority**: Understanding attribute changes over time enables cohort analysis, churn prediction, and attribution of behavior changes to lifecycle events. This is valuable but not critical for the initial MVP.

**Independent Test**: Can be fully tested by setting attributes for a user, updating them multiple times, then querying the attribute history and verifying that all changes are recorded with correct timestamps.

**Acceptance Scenarios**:

1. **Given** a user's subscription tier has changed multiple times, **When** an analyst views the attribute history, **Then** all historical values are shown with timestamps of when each change occurred
2. **Given** an attribute history exists, **When** a query asks "what was this user's plan on January 15th?", **Then** the system returns the attribute value that was active on that date
3. **Given** multiple attributes change together (e.g., plan and billing_amount both updated during upgrade), **When** viewing history, **Then** related changes are grouped by the update timestamp

---

### User Story 5 - Auto-Update System Attributes (Priority: P5)

The system automatically tracks and updates specific system-managed attributes without requiring explicit SDK calls (e.g., first_seen, last_seen, event_count, last_event_name). These provide basic behavioral metadata on every user profile.

**Why this priority**: Automatic attributes reduce integration burden and provide baseline behavioral metadata. However, this is an enhancement that can be added after core manual attribute management is working.

**Independent Test**: Can be fully tested by tracking events for a user without explicitly setting system attributes, then verifying that the system has automatically populated fields like last_seen and event_count.

**Acceptance Scenarios**:

1. **Given** a new user sends their first event, **When** the event is processed, **Then** the system automatically sets `first_seen` to the event timestamp
2. **Given** a returning user sends an event, **When** the event is processed, **Then** the system updates `last_seen` to the current timestamp and increments `event_count`
3. **Given** a user performs various event types, **When** any event is tracked, **Then** `last_event_name` is updated to reflect the most recent event

---

### Edge Cases

- What happens when attribute names conflict with reserved system attributes?
- How does the system handle attribute values that exceed size limits (e.g., 10KB)?
- What happens when the same user is identified across multiple devices with different attribute values?
- How does the system handle null or empty string attribute values?
- What happens when querying for users by an attribute that doesn't exist yet?
- How does the system handle rapidly changing attributes (e.g., hundreds of updates per minute)?
- What happens when a user identifier format changes (e.g., anonymous ID promoted to authenticated user ID)?
- How does the system handle attribute names with special characters or very long names?
- What happens when trying to query users with complex nested conditions (deeply nested AND/OR logic)?
- How does the system handle timezone differences when querying attribute history by date?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST accept user attribute updates via SDK/API with user identifier and key-value pairs of attributes
- **FR-002**: System MUST store user attributes persistently, associated with unique user identifiers
- **FR-003**: System MUST support attribute values of types: string, number, boolean, date, and null
- **FR-004**: System MUST allow updating individual attributes without affecting other existing attributes on the same user profile
- **FR-005**: System MUST provide an API to query users by single attribute conditions (equals, not equals, greater than, less than, contains)
- **FR-006**: System MUST support combining multiple attribute conditions with AND/OR logic
- **FR-007**: System MUST support querying users based on both user attributes and event behavior criteria in a single query
- **FR-008**: System MUST maintain attribute history, recording the timestamp of each attribute change
- **FR-009**: System MUST prevent attribute names from conflicting with reserved system attributes (first_seen, last_seen, user_id, etc.)
- **FR-010**: System MUST automatically track system attributes: first_seen (timestamp of first event), last_seen (timestamp of most recent event), event_count (total events for user), last_event_name (name of the most recent event)
- **FR-011**: System MUST return user query results with pagination support for large result sets
- **FR-012**: System MUST include current attribute values in query results, with option to include attribute history
- **FR-013**: System MUST validate attribute names (alphanumeric plus underscore, max 128 characters, case-insensitive)
- **FR-014**: System MUST limit attribute value size to 10KB per attribute
- **FR-015**: System MUST support batch attribute updates (multiple users' attributes in a single request)
- **FR-016**: System MUST allow querying users who have or haven't performed specific events (e.g., "users who clicked X but not Y")
- **FR-017**: System MUST support event frequency conditions in combined queries (e.g., "users with 5+ page views")
- **FR-018**: System MUST allow filtering by event properties when combining attributes with behavior (e.g., "users who made purchase where amount > $100")
- **FR-019**: System MUST correlate event data with user attributes active at the time of the event for historical accuracy
- **FR-020**: System MUST provide authentication and authorization for attribute updates and queries

### Key Entities

- **User Profile**: Represents a unique user in the system; contains user identifier, current attribute values, attribute history, and system-managed attributes (first_seen, last_seen, event_count)
- **User Attribute**: A key-value property describing a user characteristic; includes attribute name, value, data type, and timestamp of when it was set or updated
- **Attribute History Entry**: A historical record of an attribute change; includes user identifier, attribute name, old value, new value, and change timestamp
- **Combined Query**: A query definition that specifies both user attribute filters and event behavior filters; includes attribute conditions, event criteria, time ranges, and result ordering

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Developers can set user attributes and retrieve user profiles within 1 minute of SDK integration
- **SC-002**: System supports storing 100+ attributes per user; queries on a user profile with 100 attributes complete within the same 2-second SLO defined in SC-003
- **SC-003**: User attribute queries (single condition) return results within 2 seconds for databases with up to 1 million user profiles
- **SC-004**: Combined queries (attributes + event behavior) return results within 5 seconds for typical conditions (3 or fewer criteria)
- **SC-005**: Attribute updates are reflected in subsequent queries within 1 second (near real-time consistency)
- **SC-006**: System accurately maintains attribute history with no data loss, supporting time-based queries like "show me user attributes as they were 30 days ago"
- **SC-007**: Analysts can construct and execute combined queries (attributes + behavior) within 3 minutes using the query interface
- **SC-008**: System handles 1000 attribute update requests per minute without data loss or errors
- **SC-009**: 90% of combined query results match analyst expectations without requiring query refinement
- **SC-010**: Attribute validation catches invalid attribute names or oversized values with clear error messages in 100% of cases

## Assumptions _(mandatory)_

- User identifiers are managed by client applications and are consistent across events and attribute updates
- Attribute updates are relatively infrequent (not real-time streaming of attribute changes)
- Most users will have 10-50 attributes, with some power users having up to 100
- Queries will typically filter by 1-5 attributes, not hundreds of conditions
- Attribute history is retained indefinitely (no automatic purging of historical values)
- The solo developer has basic database query optimization knowledge
- Client applications handle user authentication and provide authenticated user identifiers
- Combined queries (attributes + events) will have reasonable time ranges (not "all events ever" without limits)
- The system uses the existing event storage from the base analytics service

## Scope Boundaries _(mandatory)_

### In Scope

- Setting and updating user attributes via SDK/API
- Storing user attribute history with timestamps
- Querying users by attribute conditions (single and combined)
- Combining user attributes with event behavior in queries
- Automatic system attributes (first_seen, last_seen, event_count)
- Attribute validation (name format, value size limits)
- Pagination of user query results
- Basic attribute data types (string, number, boolean, date, null)
- Batch attribute updates

### Out of Scope

- Computed attributes or attribute transformation rules (these can be added later)
- Real-time attribute streaming or change events/webhooks
- Attribute suggestions or auto-discovery based on event properties
- Complex attribute relationships or hierarchies (e.g., nested objects beyond simple values)
- User merge/unification when duplicate profiles are detected (identity resolution)
- Attribute-based access control (restricting who can see certain attributes)
- Import/export of user profiles in bulk
- Machine learning-based attribute enrichment
- Integration with external data sources for attribute enrichment
- Advanced query builder UI (basic query form acceptable for MVP)
- Query result export beyond basic CSV/JSON formats
- Query performance optimization for extremely complex conditions (10+ AND/OR clauses)

## Dependencies _(mandatory)_

- Requires the base event analytics service (feature 001) to be functional, as user attributes enhance event data
- Client applications must provide consistent user identifiers across events and attribute updates
- Combined queries depend on both user attribute storage and event storage being accessible
- Attribute history queries depend on immutable append-only storage of attribute changes

## Constraints _(mandatory)_

- Must integrate with existing event analytics database and schema
- Must be maintainable by a single developer with limited availability
- Should minimize additional database complexity beyond adding user profile tables
- Query performance must scale reasonably to 1M user profiles (acceptable to degrade gracefully beyond this)
- UI for attribute management and querying should be simple and reuse existing dashboard components
- Development should prioritize getting combined queries working over advanced features like computed attributes

## Current Implementation Notes

- User attribute APIs are programmatic endpoints authenticated with `X-API-Key`, separate from the Better Auth session used by the internal dashboard.
- The current repository test layout is `tests/unit`, `tests/api`, and `tests/e2e`.
- FR-019 is implemented: combined queries now evaluate attribute predicates against the attribute state active at each matching event timestamp rather than only the current `user_profiles.attributes` snapshot.
