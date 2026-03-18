# EventPulse API Documentation

## Events API

### Overview

The Events API allows you to submit event data from your web or mobile applications. Events are validated, stored, and made available for analytics and insights.

### Base URL

```
Production: https://your-domain.com
Development: http://localhost:3000
```

---

## Authentication

Programmatic ingestion and data APIs use an application API key passed in the request header.

```http
X-API-Key: your_api_key_here
```

To get your API key:

1. Navigate to Applications in the dashboard
2. Create a new application or view existing ones
3. Copy the API key

The internal dashboard is authenticated separately with Better Auth email/password sessions. `/sign-in` is the only public dashboard route.

API routes are not redirected through the dashboard sign-in flow. Page access is enforced by `proxy.ts`, while programmatic APIs continue to return JSON and apply their own authentication rules.

---

## Endpoints

### POST /api/events

Submit one or more events to the platform.

#### Headers

| Header         | Required | Description                |
| -------------- | -------- | -------------------------- |
| `X-API-Key`    | Yes      | Your application API key   |
| `Content-Type` | Yes      | Must be `application/json` |

#### Request Body

**Single Event:**

```json
{
  "eventId": "evt_abc123", // Optional: Custom event ID for idempotency
  "eventName": "page_view", // Required: Name of the event
  "userId": "user_123", // Required: User identifier
  "sessionId": "session_456", // Required: Session identifier
  "timestamp": "2026-03-14T10:30:00Z", // Optional: Event timestamp (defaults to now)
  "properties": {
    // Optional: Additional event data
    "page": "/dashboard",
    "referrer": "https://google.com"
  }
}
```

**Batch Events (up to 100):**

```json
[
  {
    "eventName": "page_view",
    "userId": "user_123",
    "sessionId": "session_456",
    "properties": { "page": "/home" }
  },
  {
    "eventName": "button_click",
    "userId": "user_123",
    "sessionId": "session_456",
    "properties": { "button_id": "signup" }
  }
]
```

#### Request Parameters

| Field        | Type              | Required | Description                                                      |
| ------------ | ----------------- | -------- | ---------------------------------------------------------------- |
| `eventId`    | string            | No       | Custom event ID for idempotency. Auto-generated if not provided. |
| `eventName`  | string            | Yes      | Name of the event (e.g., "page_view", "button_click")            |
| `userId`     | string            | Yes      | Unique identifier for the user                                   |
| `sessionId`  | string            | Yes      | Session identifier                                               |
| `timestamp`  | ISO 8601 datetime | No       | When the event occurred (defaults to server time)                |
| `properties` | object            | No       | Additional event metadata (any valid JSON object)                |

#### Response

**Success (201 Created):**

```json
{
  "success": true,
  "received": 2,
  "created": 2,
  "applicationId": "app_abc123",
  "applicationName": "My Web App"
}
```

**Error (400 Bad Request):**

```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "invalid_type",
      "path": ["userId"],
      "message": "User ID is required"
    }
  ]
}
```

**Error (401 Unauthorized):**

```json
{
  "error": "Missing X-API-Key header"
}
```

```json
{
  "error": "Invalid API key"
}
```

**Error (409 Conflict):**

```json
{
  "error": "Duplicate event ID detected",
  "message": "One or more events with the provided eventId already exist"
}
```

---

### GET /api/events

Health check endpoint to verify API availability.

#### Response (200 OK)

```json
{
  "service": "Event Ingestion API",
  "version": "1.0.0",
  "status": "operational",
  "endpoints": {
    "POST": {
      "description": "Submit events from web/mobile SDKs",
      "authentication": "X-API-Key header",
      "contentType": "application/json",
      "body": "Single event object or array of events"
    }
  }
}
```

---

## Examples

### cURL

**Submit single event:**

```bash
curl -X POST https://your-domain.com/api/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{
    "eventName": "page_view",
    "userId": "user_123",
    "sessionId": "session_456",
    "properties": {
      "page": "/dashboard",
      "referrer": "https://google.com"
    }
  }'
```

**Submit batch events:**

```bash
curl -X POST https://your-domain.com/api/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '[
    {
      "eventName": "page_view",
      "userId": "user_123",
      "sessionId": "session_456"
    },
    {
      "eventName": "button_click",
      "userId": "user_123",
      "sessionId": "session_456",
      "properties": { "button_id": "signup_button" }
    }
  ]'
```

### JavaScript/TypeScript

**Using fetch:**

```typescript
const response = await fetch('https://your-domain.com/api/events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here',
  },
  body: JSON.stringify({
    eventName: 'page_view',
    userId: 'user_123',
    sessionId: 'session_456',
    properties: {
      page: window.location.pathname,
      referrer: document.referrer,
    },
  }),
});

const result = await response.json();
console.log('Event tracked:', result);
```

**Using the SDK (see lib/sdk-examples.ts):**

```typescript
import { EventPulseSDK } from './lib/sdk-examples';

const analytics = new EventPulseSDK({
  apiKey: 'your_api_key_here',
  apiUrl: 'https://your-domain.com',
});

analytics.identify('user_123');
analytics.track('page_view', { page: '/dashboard' });
```

### Python

```python
import requests
import json

url = 'https://your-domain.com/api/events'
headers = {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here'
}

data = {
    'eventName': 'page_view',
    'userId': 'user_123',
    'sessionId': 'session_456',
    'properties': {
        'page': '/dashboard'
    }
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

---

## Best Practices

### 1. **Batch Events**

When possible, batch multiple events together to reduce network requests and improve performance. The API supports up to 100 events per batch.

### 2. **Use Custom Event IDs**

For critical events (e.g., purchases, signups), provide a custom `eventId` to ensure idempotency. If the same event is sent multiple times, it will only be stored once.

### 3. **Include Meaningful Properties**

Use the `properties` field to include contextual information that helps with analysis:

- Page URLs and paths
- Button IDs and labels
- Product information
- User agent and device details
- Campaign parameters (UTM tags)

### 4. **Session Management**

Generate a unique session ID when the user starts their session and use it consistently for all events during that session.

### 5. **Error Handling**

Always handle API errors gracefully:

- Retry failed requests with exponential backoff
- Queue events locally if the network is unavailable
- Log errors for debugging

### 6. **Rate Limiting**

The API has no hard rate limits, but we recommend:

- Batching events (reduce request frequency)
- Using reasonable flush intervals (5-10 seconds)
- Avoid sending duplicate events

---

## Event Naming Conventions

Use clear, descriptive event names that follow a consistent pattern:

**Good:**

- `page_view`
- `button_click`
- `form_submit`
- `purchase_complete`
- `video_play`

**Avoid:**

- Generic names: `action`, `event`, `click`
- Inconsistent casing: `PageView`, `page-view`, `page_view`
- Overly specific: `homepage_signup_button_click_with_promo`

---

## Support

For questions or issues:

- Email: support@eventpulse.com
- Documentation: https://docs.eventpulse.com
- GitHub: https://github.com/your-org/eventpulse
