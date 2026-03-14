/**
 * EventPulse SDK Examples
 *
 * This file contains examples of how to integrate with the EventPulse API
 * from web and mobile applications.
 */

// ============================================================================
// JavaScript/TypeScript SDK (Web)
// ============================================================================

interface TrackedEvent {
  eventName: string;
  userId: string;
  sessionId: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

class EventPulseSDK {
  private apiKey: string;
  private apiUrl: string;
  private sessionId: string;
  private userId: string | null = null;
  private batchQueue: TrackedEvent[] = [];
  private batchSize: number = 10;
  private flushInterval: number = 5000; // 5 seconds

  constructor(config: {
    apiKey: string;
    apiUrl?: string;
    userId?: string;
    batchSize?: number;
    flushInterval?: number;
  }) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'http://localhost:3000';
    this.sessionId = this.generateSessionId();
    this.userId = config.userId || null;
    this.batchSize = config.batchSize || 10;
    this.flushInterval = config.flushInterval || 5000;

    // Auto-flush batch periodically
    setInterval(() => this.flush(), this.flushInterval);

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  /**
   * Identify the current user
   */
  identify(userId: string) {
    this.userId = userId;
  }

  /**
   * Track a single event
   */
  async track(
    eventName: string,
    properties?: Record<string, unknown>,
    options?: { immediate?: boolean },
  ) {
    if (!this.userId) {
      console.warn('EventPulse: No user ID set. Call identify() first.');
      return;
    }

    const event = {
      eventName,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      properties: properties || {},
    };

    if (options?.immediate) {
      return this.sendEvents([event]);
    }

    this.batchQueue.push(event);

    if (this.batchQueue.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush all queued events
   */
  async flush() {
    if (this.batchQueue.length === 0) return;

    const eventsToSend = [...this.batchQueue];
    this.batchQueue = [];

    return this.sendEvents(eventsToSend);
  }

  /**
   * Send events to the API
   */
  private async sendEvents(events: TrackedEvent[]) {
    try {
      const response = await fetch(`${this.apiUrl}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(events),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('EventPulse: Failed to send events', error);
        return;
      }

      const result = await response.json();
      console.log('EventPulse: Events sent successfully', result);
    } catch (error) {
      console.error('EventPulse: Network error', error);
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Usage Example
// Initialize SDK
const analytics = new EventPulseSDK({
  apiKey: 'your_api_key_here',
  apiUrl: 'https://your-domain.com',
  batchSize: 10,
  flushInterval: 5000,
});

// Identify user
analytics.identify('user_123');

// Track events
analytics.track('page_view', {
  page: '/dashboard',
  referrer: document.referrer,
});

analytics.track('button_click', {
  button_id: 'signup_button',
  button_text: 'Sign Up',
});

// Track critical events immediately (bypass batching)
analytics.track(
  'purchase',
  {
    amount: 99.99,
    currency: 'USD',
    product_id: 'prod_123',
  },
  { immediate: true },
);

// ============================================================================
// React Hook
// ============================================================================

/*
import { useEffect, useRef } from 'react';

export function useAnalytics(apiKey: string) {
  const sdkRef = useRef<EventPulseSDK | null>(null);

  useEffect(() => {
    sdkRef.current = new EventPulseSDK({
      apiKey,
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
    });

    return () => {
      sdkRef.current?.flush();
    };
  }, [apiKey]);

  const identify = (userId: string) => {
    sdkRef.current?.identify(userId);
  };

  const track = (eventName: string, properties?: Record<string, any>) => {
    sdkRef.current?.track(eventName, properties);
  };

  return { identify, track };
}

// Usage in React component
function MyComponent() {
  const { identify, track } = useAnalytics('your_api_key');

  useEffect(() => {
    identify('user_123');
  }, []);

  const handleClick = () => {
    track('button_click', { button_id: 'my_button' });
  };

  return <button onClick={handleClick}>Click Me</button>;
}
*/

// ============================================================================
// cURL Examples
// ============================================================================

/*
# Single Event
curl -X POST http://localhost:3000/api/events \
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

# Batch Events
curl -X POST http://localhost:3000/api/events \
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
      "properties": {
        "button_id": "signup_button"
      }
    }
  ]'
*/

// ============================================================================
// React Native / Mobile SDK
// ============================================================================

/*
import AsyncStorage from '@react-native-async-storage/async-storage';

class EventPulseMobileSDK extends EventPulseSDK {
  async initialize() {
    // Restore session ID from storage
    const storedSessionId = await AsyncStorage.getItem('eventpulse_session_id');
    if (storedSessionId) {
      this.sessionId = storedSessionId;
    } else {
      await AsyncStorage.setItem('eventpulse_session_id', this.sessionId);
    }
  }

  // Override to handle mobile-specific scenarios
  async track(eventName: string, properties?: Record<string, any>) {
    // Add device info to properties
    const enrichedProperties = {
      ...properties,
      platform: 'react-native',
      // Add other device-specific info here
    };

    return super.track(eventName, enrichedProperties);
  }
}
*/

export { EventPulseSDK };
