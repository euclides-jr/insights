import { describe, it, expect } from 'vitest';

describe('Setup Verification', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with async code', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
