import { EventBus, emit, on, off } from '@/core/events/event-bus';
import { createLogger } from '@/core/logger/logger';
import { handleError } from '@/core/errors/error-handler';

jest.mock('@/core/logger/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('@/core/errors/error-handler', () => ({
  handleError: jest.fn(),
}));

describe('EventBus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emits payload to registered handlers', () => {
    const bus = new EventBus();
    const handler = jest.fn();

    bus.on('test:event', handler);
    bus.emit('test:event', { foo: 'bar' });

    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('returns subscription handles that can unsubscribe', () => {
    const bus = new EventBus();
    const handler = jest.fn();

    const subscription = bus.on('test:event', handler);
    bus.emit('test:event', {});
    expect(handler).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
    bus.emit('test:event', {});
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles async handler errors via handleError', async () => {
    const bus = new EventBus();
    const asyncHandler = jest.fn().mockRejectedValue(new Error('fail'));

    bus.on('test:event', asyncHandler);
    bus.emit('test:event', {});

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asyncHandler).toHaveBeenCalled();
    expect(handleError).toHaveBeenCalled();
  });

  it('supports singleton helpers', () => {
    const handler = jest.fn();
    const subscription = on('helper:event', handler);

    emit('helper:event', { ok: true });
    expect(handler).toHaveBeenCalled();

    off(subscription);
    emit('helper:event', {});
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
