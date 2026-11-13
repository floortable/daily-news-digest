import { describe, expect, it } from 'vitest';
import {
  applyPronunciations,
  assertLatinCompoundPronunciations,
  assertLatinNumberPronunciations,
  assertLatinPronunciations,
  assertPronunciationContinuity,
  findUnpronouncedLatinNumberTerms,
  findUnpronouncedLatinCompoundTerms,
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

  it('keeps English product names and generation numbers connected', () => {
    expect(applyPronunciations('Genie 4を発表した。', {
      'Genie 4': 'ジーニーフォー',
      Genie: 'ジーニー',
    })).toBe('ジーニーフォーを発表した。');
  });

  it('applies Microsoft 365 as one continuous reading', () => {
    expect(applyPronunciations('Microsoft 365で障害が発生した。', {
      'Microsoft 365': 'マイクロソフトスリーシックスファイブ',
      Microsoft: 'マイクロソフト',
    })).toBe('マイクロソフトスリーシックスファイブで障害が発生した。');
  });

  it('applies AWS Emulator as one continuous reading', () => {
    expect(applyPronunciations('AWS Emulatorを公開した。', {
      'AWS Emulator': 'エーダブリューエスエミュレーター',
      AWS: 'エーダブリューエス',
      Emulator: 'エミュレーター',
    })).toBe('エーダブリューエスエミュレーターを公開した。');
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

  it('rejects a residual Latin or katakana product name followed by a number', () => {
    expect(findUnpronouncedLatinNumberTerms('Microsoft 365とMysteryTool 7', {
      Microsoft: 'マイクロソフト',
    })).toEqual(['MysteryTool 7', 'マイクロソフト 365']);
    expect(() => assertLatinNumberPronunciations(['MysteryTool 7'], {}))
      .toThrow(/MysteryTool 7/);
  });

  it('rejects a space-separated Latin compound left as individual readings', () => {
    const individualWords = { AWS: 'エーダブリューエス', Emulator: 'エミュレーター' };
    expect(findUnpronouncedLatinCompoundTerms('AWS Emulatorを公開した。', individualWords))
      .toEqual(['AWS Emulator']);
    expect(() => assertLatinCompoundPronunciations(['AWS Emulatorを公開した。'], individualWords))
      .toThrow(/AWS Emulator/);
  });

  it('allows registered Latin compounds, ordinary prose, and Latin-plus-number names', () => {
    const dictionary = {
      'AWS Emulator': 'エーダブリューエスエミュレーター',
      AWS: 'エーダブリューエス',
      Emulator: 'エミュレーター',
      Microsoft: 'マイクロソフト',
    };
    expect(() => assertLatinCompoundPronunciations([
      'AWS Emulatorを公開した。',
      'これは通常の日本語文です。',
      'Microsoft 365を使います。',
    ], dictionary)).not.toThrow();
    expect(findUnpronouncedLatinCompoundTerms('AWS Emulator 2を使います。', {
      AWS: 'エーダブリューエス',
      Emulator: 'エミュレーター',
    })).toEqual([]);
  });

  it('allows ordinary numeric expressions', () => {
    expect(() => assertLatinNumberPronunciations(['291ポイント、400億ドル、2027年に確認します。'], {}))
      .not.toThrow();
  });

  it('builds project-page-safe URLs and hides unpublished media', () => {
    const published = getMediaUrls('/daily-news-digest/', '2026-10-25');
    expect(published.audio)
      .toBe('https://github.com/floortable/daily-news-digest/releases/download/media-2026-10-25/top5.m4a');
    expect(published).not.toHaveProperty('audioNoBgm');
    expect(isMediaPublished('2026-10-25')).toBe(true);
    const unpublished = getMediaUrls('/daily-news-digest/', '2026-10-24');
    expect(unpublished.audio)
      .toBe('/daily-news-digest/media/2026-10-24/top5.m4a');
    expect(unpublished).not.toHaveProperty('audioNoBgm');
    expect(isMediaPublished('2026-10-24')).toBe(false);
  });
});
