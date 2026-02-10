import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it('should schedule and run a single task', async () => {
    const limiter = new RateLimiter({ minTime: 0, maxConcurrent: 1 });
    const result = await limiter.schedule(async () => 42);
    expect(result).toBe(42);
    await limiter.disconnect();
  });

  it('should run tasks sequentially when maxConcurrent is 1', async () => {
    const limiter = new RateLimiter({ minTime: 10, maxConcurrent: 1 });
    const order: number[] = [];
    const promises = [1, 2, 3].map((n) =>
      limiter.schedule(async () => {
        order.push(n);
        return n;
      }),
    );
    const results = await Promise.all(promises);
    expect(results).toEqual([1, 2, 3]);
    expect(order).toEqual([1, 2, 3]);
    await limiter.disconnect();
  });

  it('should wrap a function', async () => {
    const limiter = new RateLimiter({ minTime: 0 });
    const wrapped = limiter.wrap(async (a: number, b: number) => a + b);
    const result = await wrapped(1, 2);
    expect(result).toBe(3);
    await limiter.disconnect();
  });
});
