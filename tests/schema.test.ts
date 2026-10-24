import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { editionSchema, normalizeUrl } from '../src/lib/schema';

describe('normalizeUrl', () => {
  it('tracking parameters and fragments are removed', () => {
    expect(normalizeUrl('HTTPS://Example.COM/a/?utm_source=x&b=2#part')).toBe('https://example.com/a?b=2');
  });
});

describe('editorial compliance', () => {
  const edition = JSON.parse(readFileSync('data/daily/2026-10-24.json', 'utf8'));

  it('accepts the reviewed sample edition', () => {
    expect(editionSchema.safeParse(edition).success).toBe(true);
  });

  it('rejects a token explanation', () => {
    const invalid = structuredClone(edition);
    invalid.articles[0].comment = '短い感想です。';
    expect(editionSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects unattributed quotation and unlicensed media', () => {
    const invalidQuote = structuredClone(edition);
    invalidQuote.articles[0].editorialReview.quotation = { used: true, text: '引用' };
    expect(editionSchema.safeParse(invalidQuote).success).toBe(false);

    const invalidMedia = structuredClone(edition);
    invalidMedia.articles[0].editorialReview.mediaAssets = [{ url: 'https://example.com/image.jpg' }];
    expect(editionSchema.safeParse(invalidMedia).success).toBe(false);
  });

  it('accepts supported social discovery channels and timestamped metrics', () => {
    const social = structuredClone(edition);
    social.articles[0].channels = ['togetter', 'reddit', '4chan'];
    social.articles[0].metrics = {
      togetterViews: 1200,
      redditScore: 450,
      redditComments: 80,
      fourChanReplies: 35,
      socialMetricsCheckedAt: '2026-10-24T11:00:00+09:00',
    };
    expect(editionSchema.safeParse(social).success).toBe(true);
  });
});
