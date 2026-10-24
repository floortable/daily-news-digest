import { describe, expect, it } from 'vitest';
import { normalizeUrl } from '../src/lib/schema';

describe('normalizeUrl', () => {
  it('tracking parameters and fragments are removed', () => {
    expect(normalizeUrl('HTTPS://Example.COM/a/?utm_source=x&b=2#part')).toBe('https://example.com/a?b=2');
  });
});
