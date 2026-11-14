import { describe, expect, it } from 'vitest';
import { extractPublishedAt, publishedAtVerdict, verifyPublishedAt } from '../scripts/verify-published-at';

describe('edition:verify-published-at', () => {
  it('JSON-LD、meta、timeの優先順で公開時刻を抽出する', () => {
    expect(extractPublishedAt('<script type="application/ld+json">{"@graph":[{"datePublished":"2026-11-14T10:00:00+09:00"}]}</script><meta property="article:published_time" content="2026-11-14T11:00:00+09:00">')).toBe('2026-11-14T10:00:00+09:00');
    expect(extractPublishedAt('<meta property="article:published_time" content="2026-11-14T11:00:00+09:00">')).toBe('2026-11-14T11:00:00+09:00');
    expect(extractPublishedAt('<time datetime="2026-11-14T12:00:00+09:00">14 Nov</time>')).toBe('2026-11-14T12:00:00+09:00');
  });

  it('タイムゾーンなしのJSON-LDよりタイムゾーン付きmetaを優先する', () => {
    const html = '<script type="application/ld+json">{"datePublished":"November 12, 2026 09:30 AM"}</script><meta property="article:published_time" content="2026-11-12T15:30:00+00:00">';
    expect(extractPublishedAt(html)).toBe('2026-11-12T15:30:00+00:00');
    expect(publishedAtVerdict('2026-11-13T00:30:00+09:00', extractPublishedAt(html))).toBe('match');
  });

  it('match、mismatch、unverifiableを判定する', () => {
    expect(publishedAtVerdict('2026-11-14T10:00:00+09:00', '2026-11-14T10:59:00+09:00')).toBe('match');
    expect(publishedAtVerdict('2026-11-14T10:00:00+09:00', '2026-11-14T11:01:00+09:00')).toBe('mismatch');
    expect(publishedAtVerdict('2026-11-14T10:00:00+09:00', '2026-11-13')).toBe('mismatch');
    expect(publishedAtVerdict('2026-11-14T10:00:00+09:00', null)).toBe('unverifiable');
  });

  it('タイムゾーンなしの候補だけなら理由付きでunverifiableにする', async () => {
    const [result] = await verifyPublishedAt([{ id: 'one', sourceUrl: 'https://example.test', publishedAt: '2026-11-13T00:30:00+09:00' }], async () => '<script type="application/ld+json">{"datePublished":"November 12, 2026 09:30 AM"}</script>');
    expect(result).toEqual({ id: 'one', publishedAt: '2026-11-13T00:30:00+09:00', extractedAt: 'November 12, 2026 09:30 AM', verdict: 'unverifiable', note: 'timezone-less extracted timestamp' });
  });

  it('取得失敗をunverifiableとして返す', async () => {
    const [result] = await verifyPublishedAt([{ id: 'one', sourceUrl: 'https://example.test', publishedAt: '2026-11-14T10:00:00+09:00' }], async () => { throw new Error('offline'); });
    expect(result).toEqual({ id: 'one', publishedAt: '2026-11-14T10:00:00+09:00', extractedAt: null, verdict: 'unverifiable', note: 'failed to fetch article page' });
  });

  it('時刻がない場合を取得失敗と区別する', async () => {
    const [result] = await verifyPublishedAt([{ id: 'one', sourceUrl: 'https://example.test', publishedAt: '2026-11-14T10:00:00+09:00' }], async () => '<html></html>');
    expect(result).toEqual({ id: 'one', publishedAt: '2026-11-14T10:00:00+09:00', extractedAt: null, verdict: 'unverifiable', note: 'no published timestamp extracted' });
  });
});
