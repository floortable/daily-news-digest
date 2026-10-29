import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editionSchema } from '../src/lib/schema';
import {
  assertPoliteNarration,
  buildNarrationPlan,
  findPlainNarrationEndings,
  formatReactionForNarration,
  toBroadcastStyle,
} from '../scripts/media/narration';

const edition = editionSchema.parse(JSON.parse(readFileSync('data/daily/2026-10-25.json', 'utf8')));
const cast = [
  { name: '満別花丸', style: 'ノーマル', speedScale: 1.08 },
  { name: 'ずんだもん', style: 'ノーマル', speedScale: 1.05 },
  { name: '四国めたん', style: 'ノーマル', speedScale: 1.05 },
  { name: '冥鳴ひまり', style: 'ノーマル', speedScale: 1.1, intonationScale: 0.7 },
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

  it('uses all four casters across the program and preserves the reaction', () => {
    expect(new Set(plan.segments.map((segment) => segment.speaker.name))).toEqual(
      new Set(['満別花丸', 'ずんだもん', '四国めたん', '冥鳴ひまり']),
    );
    const segment = plan.segments.find((item) => item.id === 'rank-1')!;
    expect(segment.text).toContain('Hacker Newsで415ポイント、392コメント');
    expect(segment.text).not.toContain('である。');
    expect(plan.segments.map((item) => item.text).join(' ')).not.toContain('ましたのだ');
  });

  it('puts one concise reaction sentence directly before the article body', () => {
    const first = edition.articles.find((article) => article.top5Rank === 1)!;
    const lead = plan.segments.find((item) => item.id === 'rank-1')!;
    const explanation = plan.segments.find((item) => item.id === 'rank-1-explanation')!;
    expect(lead.text).toContain('Hacker Newsで415ポイント、392コメント');
    expect(explanation.text).toContain(toBroadcastStyle(`${first.narration!.detail[0].split('。')[0]}。`));
    expect(lead.text).not.toContain(toBroadcastStyle(`${first.summary[0].split('。')[0]}。`));
    expect(lead.text).not.toContain('反響は大きいと言えます');
    expect(lead.text).not.toContain('注目度の評価は');
    expect(lead.text).not.toContain('続いて、内容です');
  });

  it('omits exact reaction timestamps from narration without changing source data', () => {
    const source = 'Hacker Newsで635ポイント、385コメントを2026年10月28日8時24分に確認した。';
    expect(formatReactionForNarration(source))
      .toBe('Hacker Newsでは、今朝の時点で635ポイント、385コメントです。');
    expect(source).toContain('2026年10月28日8時24分');
  });

  it('rejects plain-form sentence endings left in caster narration', () => {
    expect(findPlainNarrationEndings('更新を求める。結果を確認した。対応が難しい。'))
      .toEqual(['更新を求める。', '結果を確認した。', '対応が難しい。']);
    expect(() => assertPoliteNarration([{
      id: 'plain-ending',
      speaker: cast[0],
      text: '更新を求める。',
    }])).toThrow(/常体の文末/);
    expect(() => assertPoliteNarration([{
      id: 'unknown-plain-ending',
      speaker: cast[0],
      text: '集中管理ポリシーで認可を行う。',
    }])).toThrow(/常体の文末/);
    expect(findPlainNarrationEndings('更新を求めます。結果を確認しました。対応が難しいです。'))
      .toEqual([]);
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

  it('turns anticipated listener questions into direct commentary', () => {
    for (const article of edition.articles.filter((item) => item.top5Rank !== null)) {
      const text = articleText(article.top5Rank!);
      for (const item of article.narration!.anticipatedQuestions) {
        const question = item.question.replace(/[。？！?！]+$/, '');
        expect(text).not.toContain(question);
        const answerLead = `${item.answer.split('。')[0]}。`;
        expect(text).toContain(toBroadcastStyle(answerLead));
      }
      expect(text).not.toContain('ここで気になるのは');
      expect(text).not.toMatch(/でしょうか[。？！]/);
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
    expect(explanationSpeakers.size).toBe(4);
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
      expect(segment.text).not.toContain('ここが、この話題を見るうえでのポイント');
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
    expect(toBroadcastStyle('重要である。結果は変わる。人数は確定しない。応募率で決まる。会社はAI置換だと説明していない。'))
      .toBe('重要です。結果は変わります。人数は確定しません。応募率で決まります。会社はAI置換だと説明していません。');
  });

  it('uses natural spoken country names instead of newspaper abbreviations', () => {
    expect(toBroadcastStyle('米国と英国が説明した。米政府は日米関係と米中競争を説明した。米国エネルギー省は米国内を説明した。'))
      .toBe('アメリカとイギリスが説明しました。アメリカ政府は日本とアメリカの関係とアメリカと中国の競争を説明しました。アメリカのエネルギー省はアメリカ国内を説明しました。');
  });
});
