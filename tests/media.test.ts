import { describe, expect, it } from 'vitest';
import {
  applyPronunciations,
  assertLatinPronunciations,
  assertPronunciationContinuity,
  findUnpronouncedLatinTerms,
} from '../scripts/media/pronunciation';
import { getMediaUrls, isMediaPublished } from '../src/lib/media';

describe('media publishing', () => {
  it('applies longer pronunciation keys first', () => {
    expect(applyPronunciations('HTTP2Shell and HTTP', { HTTP: 'エイチティーティーピー', HTTP2Shell: 'シェル' }))
      .toBe('シェル and エイチティーティーピー');
  });

  it('does not apply another dictionary rule inside a generated reading', () => {
    expect(applyPronunciations('AIとA', { AI: 'エーエイ', A: 'ア' }))
      .toBe('エーエイとア');
  });

  it('keeps English names and initialisms connected without artificial pauses', () => {
    const dictionary = {
      'Hacker News': 'ハッカーニューズ',
      AP通信: 'エーピー通信',
      AP: 'エーピー',
      URL: 'ユーアールエル',
    };
    expect(applyPronunciations('Hacker News、AP通信、URL', dictionary))
      .toBe('ハッカーニューズ、エーピー通信、ユーアールエル');
    expect(() => assertPronunciationContinuity({ URL: 'ユー・アール・エル' }))
      .toThrow(/中黒/);
    expect(() => assertPronunciationContinuity({ AP: 'エー、ピー' }))
      .toThrow(/読点/);
    expect(() => assertPronunciationContinuity({ 注意書き: '前半、後半' }))
      .not.toThrow();
  });

  it('uses contextual readings for ambiguous counters', () => {
    expect(applyPronunciations('更新と再起動までを一組として扱います。', { 一組として: 'ひとくみとして' }))
      .toBe('更新と再起動までをひとくみとして扱います。');
  });

  it('uses the correct reading for weed-control compounds', () => {
    expect(applyPronunciations('防草シートと防草砂', {
      防草シート: 'ぼうそうシート',
      防草砂: 'ぼうそうずな',
    })).toBe('ぼうそうシートとぼうそうずな');
  });

  it('detects English product and library names without confirmed readings', () => {
    expect(findUnpronouncedLatinTerms('BrotliとUnknownSDK', { Brotli: 'ブロートリ' }))
      .toEqual(['UnknownSDK']);
    expect(() => assertLatinPronunciations(
      ['Node.jsとMysteryLib'],
      { 'Node.js': 'ノードジェイエス' },
    )).toThrow(/MysteryLib/);
  });

  it('builds project-page-safe URLs and hides unpublished media', () => {
    expect(getMediaUrls('/daily-news-digest/', '2026-10-25').audio)
      .toBe('https://github.com/floortable/daily-news-digest/releases/download/media-2026-10-25/top5.m4a');
    expect(isMediaPublished('2026-10-25')).toBe(true);
    expect(getMediaUrls('/daily-news-digest/', '2026-10-24').audio)
      .toBe('/daily-news-digest/media/2026-10-24/top5.m4a');
    expect(isMediaPublished('2026-10-24')).toBe(false);
  });
});
