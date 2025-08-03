// --- AGENT DIRECTIVE BLOCK ---
// file: /src/core/events/event-bus.ts
// purpose: Application-wide event system with voice event routing and pub-sub messaging
// spec_ref: core#event-bus
// version: 2025-08-1
// domain: core-infrastructure
// phase: 1
// complexity_budget: high
// offline_capability: REQUIRED

// dependencies:
//   - src/core/logger/logger.ts
//   - src/core/errors/error-handler.ts

// exports:
//   - EventBus: class - Main event system service
//   - emit<T>(event: string, data: T): void - Event emission function
//   - on<T>(event: string, handler: EventHandler<T>): EventSubscription - Event subscription
//   - off(subscription: EventSubscription): void - Event unsubscription
//   - EventHandler<T>: type - Event handler function signature
//   - EventSubscription: interface - Event subscription handle

// voice_considerations: |
//   Voice events should have dedicated routing with priority queuing for real-time speech.
//   Support voice event broadcasting to multiple handlers for command processing chains.
//   Voice interaction events should include audio context and user session information.
//   Failed voice events should trigger fallback handling and user notification.

// security_considerations: |
//   Event data must be validated and sanitized before emission to prevent injection attacks.
//   Event handlers must be authenticated and authorized for sensitive event types.
//   Implement event filtering to prevent unauthorized access to restricted events.
//   Event logs must not contain sensitive user data or system credentials.

// performance_considerations: |
//   Use asynchronous event processing to prevent blocking the main application thread.
//   Implement event queuing with priority handling for time-sensitive voice events.
//   Cache event subscriptions to avoid repeated handler lookup operations.
//   Use event batching for high-frequency events to reduce processing overhead.

// tasks:
//     1. Create EventBus singleton with typed event emission and subscription system
//     2. Implement event handler registration with automatic cleanup and memory management
//     3. Add event priority queuing with separate high-priority queue for voice events
//     4. Create event filtering system with subscription-based access control
//     5. Implement event persistence for offline replay when connection is restored
//     6. Add event middleware support for logging, validation, and transformation
//     7. Create event handler error isolation to prevent one handler from breaking others
//     8. Implement event batching and debouncing for high-frequency event optimization
//     9. Add event analytics and monitoring for system performance analysis
//     10. Create event debugging tools with event history and handler performance metrics
// --- END DIRECTIVE BLOCK ---

import { createLogger } from '../logger/logger';
import { handleError } from '../errors/error-handler';

const logger = createLogger('event-bus');

export type EventHandler<T = any> = (data: T) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  event: string;
  handler: EventHandler;
  unsubscribe: () => void;
}

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, EventHandler[]> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  
  emit<T>(event: string, data: T): void {
    const handlers = this.listeners.get(event) || [];
    
    logger.debug(`Emitting event: ${event}`, { handlerCount: handlers.length });
    
    for (const handler of handlers) {
      try {
        const result = handler(data);
        if (result instanceof Promise) {
          result.catch(error => {
            handleError(error, { operation: 'event-handler', event });
          });
        }
      } catch (error) {
        handleError(error as Error, { operation: 'event-handler', event });
      }
    }
  }
  
  on<T>(event: string, handler: EventHandler<T>): EventSubscription {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event)!.push(handler);
    
    const subscription: EventSubscription = {
      id,
      event,
      handler,
      unsubscribe: () => this.off(subscription)
    };
    
    this.subscriptions.set(id, subscription);
    
    logger.debug(`Registered event handler for: ${event}`, { subscriptionId: id });
    
    return subscription;
  }
  
  off(subscription: EventSubscription): void {
    const handlers = this.listeners.get(subscription.event);
    if (handlers) {
      const index = handlers.indexOf(subscription.handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
    
    this.subscriptions.delete(subscription.id);
    
    logger.debug(`Unregistered event handler for: ${subscription.event}`, { subscriptionId: subscription.id });
  }
}

const eventBus = EventBus.getInstance();

export const emit = <T>(event: string, data: T): void => eventBus.emit(event, data);
export const on = <T>(event: string, handler: EventHandler<T>): EventSubscription => eventBus.on(event, handler);
export const off = (subscription: EventSubscription): void => eventBus.off(subscription);