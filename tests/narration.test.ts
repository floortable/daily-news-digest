import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editionSchema } from '../src/lib/schema';
import { buildNarrationPlan, toBroadcastStyle } from '../scripts/media/narration';

const edition = editionSchema.parse(JSON.parse(readFileSync('data/daily/2026-10-25.json', 'utf8')));
const cast = [
  { name: '満別花丸', style: 'ノーマル', speedScale: 1.08 },
  { name: 'ずんだもん', style: 'ノーマル', speedScale: 1.05 },
  { name: '四国めたん', style: 'ノーマル', speedScale: 1.05 },
];

describe('Top 5 narration plan', () => {
  const plan = buildNarrationPlan(edition, cast, 'VOICEVOX credit');
  const articleSegments = (rank: number) => plan.segments.filter((segment) =>
    segment.id === `rank-${rank}` || segment.id.startsWith(`rank-${rank}-`));
  const articleText = (rank: number) => articleSegments(rank).map((segment) => segment.text).join(' ');

  it('builds an opening, at most three clear roles for each story, and a closing', () => {
    expect(plan.segments).toHaveLength(17);
    for (let rank = 1; rank <= 5; rank += 1) {
      expect(articleSegments(rank).map((segment) => segment.id)).toEqual([
        `rank-${rank}`, `rank-${rank}-explanation`, `rank-${rank}-perspective`,
      ]);
      expect(articleSegments(rank)).toHaveLength(3);
    }
  });

  it('presents five topics without ranking language', () => {
    for (const segment of plan.segments.filter((item) => item.id.startsWith('rank-'))) {
      expect(segment.text).not.toMatch(/第[1-5]位/);
    }
  });

  it('uses all three casters and preserves the reaction in broadcast style', () => {
    expect(new Set(plan.segments.map((segment) => segment.speaker.name))).toEqual(
      new Set(['満別花丸', 'ずんだもん', '四国めたん']),
    );
    const first = edition.articles.find((article) => article.top5Rank === 1)!;
    const segment = plan.segments.find((item) => item.id === 'rank-1')!;
    expect(segment.text).toContain(toBroadcastStyle(first.attentionAnalysis.currentReaction));
    expect(segment.text).not.toContain('である。');
  });

  it('puts one concise reaction sentence directly before the article body', () => {
    const first = edition.articles.find((article) => article.top5Rank === 1)!;
    const lead = plan.segments.find((item) => item.id === 'rank-1')!;
    const explanation = plan.segments.find((item) => item.id === 'rank-1-explanation')!;
    expect(lead.text).toContain(toBroadcastStyle(first.attentionAnalysis.currentReaction));
    expect(explanation.text).toContain(toBroadcastStyle(`${first.narration!.detail[0].split('。')[0]}。`));
    expect(lead.text).not.toContain(toBroadcastStyle(`${first.summary[0].split('。')[0]}。`));
    expect(lead.text).not.toContain('反響は大きいと言えます');
    expect(lead.text).not.toContain('注目度の評価は');
    expect(lead.text).not.toContain('続いて、内容です');
  });

  it('includes source-checked narration detail without character filler', () => {
    for (const article of edition.articles.filter((item) => item.top5Rank !== null)) {
      const text = articleText(article.top5Rank!);
      expect(article.narration?.detail.length).toBeGreaterThan(0);
      const detailLead = `${article.narration!.detail[0].split('。')[0]}。`;
      const learningLead = `${article.narration!.learning[0].split('。')[0]}。`;
      const analysisLead = `${article.narration!.analysis[0].split('。')[0]}。`;
      expect(text).toContain(toBroadcastStyle(detailLead));
      expect(text).toContain(toBroadcastStyle(learningLead));
      expect(text).toContain(toBroadcastStyle(analysisLead));
      expect(text).not.toContain('見ていくのだ');
      expect(text).not.toContain('原文の更新、反対意見');
    }
  });

  it('anticipates concrete listener questions and answers them', () => {
    for (const article of edition.articles.filter((item) => item.top5Rank !== null)) {
      const text = articleText(article.top5Rank!);
      expect(article.narration?.anticipatedQuestions.length).toBeGreaterThan(0);
      for (const item of article.narration!.anticipatedQuestions) {
        expect(text).toContain(`${item.question.replace(/[。？！?！]+$/, '')}という点です。`);
        const answerLead = `${item.answer.split('。')[0]}。`;
        expect(text).toContain(toBroadcastStyle(answerLead));
      }
    }
  });

  it('uses one caster per role and rotates those roles between stories', () => {
    for (let rank = 1; rank <= 5; rank += 1) {
      const speakers = articleSegments(rank).map((segment) => segment.speaker.name);
      expect(speakers).toHaveLength(3);
      expect(new Set(speakers).size).toBe(3);
    }
    const explanationSpeakers = new Set(
      plan.segments.filter((segment) => /-explanation$/.test(segment.id)).map((segment) => segment.speaker.name),
    );
    expect(explanationSpeakers.size).toBe(3);
  });

  it('does not repeat an identical sentence across roles in one story', () => {
    for (let rank = 1; rank <= 5; rank += 1) {
      const sentences = articleSegments(rank).flatMap((segment) =>
        segment.text.split(/(?<=。)/).map((sentence) => sentence.trim()).filter(Boolean));
      expect(new Set(sentences).size).toBe(sentences.length);
    }
  });

  it('uses restrained Zundamon endings in each assigned section', () => {
    const topics = plan.segments.filter((segment) => segment.id.startsWith('rank-') && segment.speaker.name === 'ずんだもん');
    for (const segment of topics) {
      expect((segment.text.match(/のだ。/g) ?? []).length).toBeGreaterThanOrEqual(1);
      expect((segment.text.match(/のだ。/g) ?? []).length).toBeLessThanOrEqual(3);
      expect(segment.text.endsWith('のだ。')).toBe(true);
    }
  });

  it('states the weed-sand outcome before its background', () => {
    const article = edition.articles.find((item) => item.id === '2026-10-25-cainz-weed-sand-test')!;
    const text = articleText(5);
    expect(text.indexOf('結論から言うと'))
      .toBeLessThan(text.indexOf(toBroadcastStyle(`${article.narration!.detail[0].split('。')[0]}。`)));
    expect(text).toContain('半年後も切り株の周囲や飛んできた種から少量の草が生えた程度');
    expect(text).toContain('送料だけで単純計算12万円');
    expect(text).toContain('およそ50から67平方メートル');
  });

  it('turns written-form endings into natural broadcast speech', () => {
    expect(toBroadcastStyle('重要である。結果は変わる。分析した。'))
      .toBe('重要です。結果は変わります。分析しました。');
  });
});
