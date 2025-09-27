import { EventBus, DomainEvent, EventType, createEventBus } from '@/core/events/event-bus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('publish', () => {
    it('should publish event to all subscribers', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      const event: DomainEvent = {
        id: 'evt-123',
        type: 'test.event' as EventType,
        aggregateId: 'agg-123',
        timestamp: new Date(),
        payload: { data: 'test' },
      };

      eventBus.subscribe('test.event' as EventType, handler1);
      eventBus.subscribe('test.event' as EventType, handler2);

      await eventBus.publish(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should not call handlers for different event types', async () => {
      const handler = jest.fn();
      
      const event: DomainEvent = {
        id: 'evt-123',
        type: 'test.event' as EventType,
        aggregateId: 'agg-123',
        timestamp: new Date(),
        payload: {},
      };

      eventBus.subscribe('other.event' as EventType, handler);

      await eventBus.publish(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle async handlers', async () => {
      const asyncHandler = jest.fn().mockResolvedValue('result');
      
      const event: DomainEvent = {
        id: 'evt-123',
        type: 'test.event' as EventType,
        aggregateId: 'agg-123',
        timestamp: new Date(),
        payload: {},
      };

      eventBus.subscribe('test.event' as EventType, asyncHandler);

      await eventBus.publish(event);

      expect(asyncHandler).toHaveBeenCalledWith(event);
      await expect(asyncHandler.mock.results[0].value).resolves.toBe('result');
    });

    it('should continue publishing even if one handler fails', async () => {
      const failingHandler = jest.fn().mockRejectedValue(new Error('Handler failed'));
      const successHandler = jest.fn();
      
      const event: DomainEvent = {
        id: 'evt-123',
        type: 'test.event' as EventType,
        aggregateId: 'agg-123',
        timestamp: new Date(),
        payload: {},
      };

      eventBus.subscribe('test.event' as EventType, failingHandler);
      eventBus.subscribe('test.event' as EventType, successHandler);

      await eventBus.publish(event);

      expect(failingHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });

    it('should include metadata in events', async () => {
      const handler = jest.fn();
      
      const event: DomainEvent = {
        id: 'evt-123',
        type: 'test.event' as EventType,
        aggregateId: 'agg-123',
        timestamp: new Date(),
        tenantId: 'tenant-123',
        userId: 'user-123',
        payload: { data: 'test' },
        metadata: { version: 1, source: 'test' },
      };

      eventBus.subscribe('test.event' as EventType, handler);

      await eventBus.publish(event);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'tenant-123',
        userId: 'user-123',
        metadata: { version: 1, source: 'test' },
      }));
    });
  });

  describe('subscribe', () => {
    it('should return unsubscribe function', async () => {
      const handler = jest.fn();
      
      const event: DomainEvent = {
        id: 'evt-123',
        type: 'test.event' as EventType,
        aggregateId: 'agg-123',
        timestamp: new Date(),
        payload: {},
      };

      const unsubscribe = eventBus.subscribe('test.event' as EventType, handler);

      await eventBus.publish(event);
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      await eventBus.publish(event);
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should allow multiple subscriptions to same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      eventBus.subscribe('test.event' as EventType, handler1);
      eventBus.subscribe('test.event' as EventType, handler2);
      eventBus.subscribe('test.event' as EventType, handler3);

      const event: DomainEvent = {
        id: 'evt-123',
        type: 'test.event' as EventType,
        aggregateId: 'agg-123',
        timestamp: new Date(),
        payload: {},
      };

      eventBus.publish(event);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
    });

    it('should handle subscribing to multiple event types', () => {
      const handler = jest.fn();

      eventBus.subscribe('event.one' as EventType, handler);
      eventBus.subscribe('event.two' as EventType, handler);
      eventBus.subscribe('event.three' as EventType, handler);

      const event1: DomainEvent = {
        id: 'evt-1',
        type: 'event.one' as EventType,
        aggregateId: 'agg-1',
        timestamp: new Date(),
        payload: {},
      };

      const event2: DomainEvent = {
        id: 'evt-2',
        type: 'event.two' as EventType,
        aggregateId: 'agg-2',
        timestamp: new Date(),
        payload: {},
      };

      eventBus.publish(event1);
      eventBus.publish(event2);

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe specific handler', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      const event: DomainEvent = {
        id: 'evt-123',
        type: 'test.event' as EventType,
        aggregateId: 'agg-123',
        timestamp: new Date(),
        payload: {},
      };

      eventBus.subscribe('test.event' as EventType, handler1);
      eventBus.subscribe('test.event' as EventType, handler2);

      eventBus.unsubscribe('test.event' as EventType, handler1);

      await eventBus.publish(event);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should handle unsubscribing non-existent handler gracefully', () => {
      const handler = jest.fn();

      expect(() => {
        eventBus.unsubscribe('test.event' as EventType, handler);
      }).not.toThrow();
    });

    it('should handle unsubscribing from non-existent event type', () => {
      const handler = jest.fn();

      expect(() => {
        eventBus.unsubscribe('non.existent' as EventType, handler);
      }).not.toThrow();
    });
  });

  describe('factory function', () => {
    it('should create event bus instance', () => {
      const bus = createEventBus();
      expect(bus).toBeInstanceOf(EventBus);
    });
  });

  describe('error handling', () => {
    it('should log errors from failing handlers', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Handler error');
      const failingHandler = jest.fn().mockRejectedValue(error);
      
      const event: DomainEvent = {
        id: 'evt-123',
        type: 'test.event' as EventType,
        aggregateId: 'agg-123',
        timestamp: new Date(),
        payload: {},
      };

      eventBus.subscribe('test.event' as EventType, failingHandler);

      await eventBus.publish(event);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in event handler:',
        error
      );

      consoleSpy.mockRestore();
    });
  });

  describe('event ordering', () => {
    it('should call handlers in subscription order', async () => {
      const callOrder: number[] = [];
      const handler1 = jest.fn(() => callOrder.push(1));
      const handler2 = jest.fn(() => callOrder.push(2));
      const handler3 = jest.fn(() => callOrder.push(3));
      
      const event: DomainEvent = {
        id: 'evt-123',
        type: 'test.event' as EventType,
        aggregateId: 'agg-123',
        timestamp: new Date(),
        payload: {},
      };

      eventBus.subscribe('test.event' as EventType, handler1);
      eventBus.subscribe('test.event' as EventType, handler2);
      eventBus.subscribe('test.event' as EventType, handler3);

      await eventBus.publish(event);

      expect(callOrder).toEqual([1, 2, 3]);
    });
  });

  describe('memory management', () => {
    it('should not retain references to unsubscribed handlers', () => {
      const handler = jest.fn();
      const eventType = 'test.event' as EventType;

      const unsubscribe = eventBus.subscribe(eventType, handler);
      unsubscribe();

      // Access internal state (if exposed) or test indirectly
      const event: DomainEvent = {
        id: 'evt-123',
        type: eventType,
        aggregateId: 'agg-123',
        timestamp: new Date(),
        payload: {},
      };

      eventBus.publish(event);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});