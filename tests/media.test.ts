import { describe, expect, it } from 'vitest';
import { applyPronunciations } from '../scripts/media/pronunciation';
import { getMediaUrls, isMediaPublished } from '../src/lib/media';

describe('media publishing', () => {
  it('applies longer pronunciation keys first', () => {
    expect(applyPronunciations('HTTP2Shell and HTTP', { HTTP: 'エイチティーティーピー', HTTP2Shell: 'シェル' }))
      .toBe('シェル and エイチティーティーピー');
  });

  it('builds project-page-safe URLs and hides unpublished media', () => {
    expect(getMediaUrls('/daily-news-digest/', '2026-10-25').audio)
      .toBe('/daily-news-digest/media/2026-10-25/top5.m4a');
    expect(isMediaPublished('2026-10-25')).toBe(false);
  });
});
