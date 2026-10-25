import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editionSchema } from '../src/lib/schema';
import { buildNarrationPlan, describeReactionMagnitude, toBroadcastStyle } from '../scripts/media/narration';

const edition = editionSchema.parse(JSON.parse(readFileSync('data/daily/2026-10-25.json', 'utf8')));
const cast = [
  { name: '満別花丸', style: 'ノーマル', speedScale: 1.08 },
  { name: 'ずんだもん', style: 'ノーマル', speedScale: 1.05 },
  { name: '四国めたん', style: 'ノーマル', speedScale: 1.05 },
];

describe('Top 5 narration plan', () => {
  const plan = buildNarrationPlan(edition, cast, 'VOICEVOX credit');

  it('builds an opening, five stories, and a closing', () => {
    expect(plan.segments).toHaveLength(7);
    expect(plan.segments.map((segment) => segment.id)).toEqual([
      'opening', 'rank-1', 'rank-2', 'rank-3', 'rank-4', 'rank-5', 'closing',
    ]);
  });

  it('uses all three casters and preserves the editorial meaning in broadcast style', () => {
    expect(new Set(plan.segments.map((segment) => segment.speaker.name))).toEqual(
      new Set(['満別花丸', 'ずんだもん', '四国めたん']),
    );
    const first = edition.articles.find((article) => article.top5Rank === 1)!;
    const segment = plan.segments.find((item) => item.id === 'rank-1')!;
    const firstSummarySentence = `${first.summary[0].split('。')[0]}。`;
    expect(segment.text).toContain(toBroadcastStyle(firstSummarySentence));
    expect(segment.text).toContain(toBroadcastStyle(first.attentionAnalysis.currentReaction));
    expect(segment.text).not.toContain('である。');
  });

  it('puts reaction and its scale before the article body', () => {
    const first = edition.articles.find((article) => article.top5Rank === 1)!;
    const segment = plan.segments.find((item) => item.id === 'rank-1')!;
    const bodyLead = toBroadcastStyle(`${first.summary[0].split('。')[0]}。`);
    expect(segment.text.indexOf(toBroadcastStyle(first.attentionAnalysis.currentReaction)))
      .toBeLessThan(segment.text.indexOf(bodyLead));
    expect(segment.text).toContain('反響は大きいと言えます');
    expect(segment.text).toContain('評価が分かれています');
    expect(segment.text).not.toContain('評価が分かれるです');
  });

  it('adds a restrained Zundamon ending only to the presenter bridge', () => {
    const zundamonSegments = plan.segments.filter((segment) => segment.speaker.name === 'ずんだもん');
    expect(zundamonSegments.length).toBeGreaterThan(0);
    for (const segment of zundamonSegments) expect(segment.text.match(/のだ/g)).toHaveLength(1);
  });

  it('does not claim a scale without numeric public metrics', () => {
    const fifth = edition.articles.find((article) => article.top5Rank === 5)!;
    expect(describeReactionMagnitude(fifth)).toBe('');
  });

  it('turns written-form endings into natural broadcast speech', () => {
    expect(toBroadcastStyle('重要である。結果は変わる。分析した。'))
      .toBe('重要です。結果は変わります。分析しました。');
  });
});
