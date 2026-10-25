import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editionSchema } from '../src/lib/schema';
import { buildNarrationPlan } from '../scripts/media/narration';

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

  it('uses all three casters and includes full editorial text', () => {
    expect(new Set(plan.segments.map((segment) => segment.speaker.name))).toEqual(
      new Set(['満別花丸', 'ずんだもん', '四国めたん']),
    );
    const first = edition.articles.find((article) => article.top5Rank === 1)!;
    const segment = plan.segments.find((item) => item.id === 'rank-1')!;
    expect(segment.text).toContain(first.summary[0]);
    expect(segment.text).toContain(first.comment);
    expect(segment.text).toContain(first.attentionAnalysis.currentReaction);
  });
});
