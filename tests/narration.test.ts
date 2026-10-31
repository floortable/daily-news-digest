import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editionSchema } from '../src/lib/schema';
import {
  assertPoliteNarration,
  assertNoBareEnumerations,
  buildNarrationPlan,
  findBareEnumerations,
  findPlainNarrationEndings,
  formatReactionForNarration,
  toBroadcastStyle,
} from '../scripts/media/narration';

const edition = editionSchema.parse(JSON.parse(readFileSync('data/daily/2026-10-25.json', 'utf8')));
const currentEdition = editionSchema.parse(JSON.parse(readFileSync('data/daily/2026-10-29.json', 'utf8')));
const latestEdition = editionSchema.parse(JSON.parse(readFileSync('data/daily/2026-10-30.json', 'utf8')));
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
    expect(formatReactionForNarration('AP通信の記事はHacker Newsで2097ポイント、413コメントを2026年10月30日7時42分に確認しました。'))
      .toBe('Hacker Newsでは、今朝の時点で2097ポイント、413コメントです。');
  });

  it('does not read editorial fallback text when reaction metrics are unavailable', () => {
    const fallback = '公開記事と一次資料を確認しました。取得できない反応数は推測せず、内容の広がりと検証可能性を優先しました。';
    expect(formatReactionForNarration(fallback)).toBe('');
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

    const currentPlan = buildNarrationPlan(currentEdition, cast, 'VOICEVOX credit');
    const spokenText = currentPlan.segments.map((segment) => segment.text).join('\n');
    expect(spokenText).not.toMatch(/米国|英国|米政府|英政府|日米|米中|米英|日英/);
  });

  it('identifies unfamiliar journals instead of naming them without context', () => {
    const currentPlan = buildNarrationPlan(currentEdition, cast, 'VOICEVOX credit');
    const spokenText = currentPlan.segments.map((segment) => segment.text).join('\n');
    expect(spokenText).toContain('科学誌Scienceを発行するアメリカ科学振興協会、AAASの査読付き総合科学誌Science Advances');
  });

  it('does not pad stories with editorial restraint or future-check filler', () => {
    const latestPlan = buildNarrationPlan(latestEdition, cast, 'VOICEVOX credit');
    const spokenText = latestPlan.segments.map((segment) => segment.text).join('\n');
    expect(spokenText).not.toMatch(/私生活を推測せず|公開を待つ必要があります|このニュースで結論を変える次の確認点|追加発表.+確認します/);
    expect(latestPlan.segments.filter((segment) => segment.id.startsWith('rank-2')).length).toBeLessThanOrEqual(3);

    const invalidEdition = structuredClone(latestEdition);
    const first = invalidEdition.articles.find((article) => article.top5Rank === 1)!;
    first.narration!.analysis = ['公表されていない私生活を推測せず、本人側が明らかにした範囲と作品歴を分けて扱います。'];
    expect(() => editionSchema.parse(invalidEdition)).toThrow(/編集上の自制だけ/);
  });

  it('states demo results and significance before a bounded limitation', () => {
    const latestPlan = buildNarrationPlan(latestEdition, cast, 'VOICEVOX credit');
    const qwenputer = latestPlan.segments
      .filter((segment) => segment.id.startsWith('rank-5'))
      .map((segment) => segment.text)
      .join(' ');
    expect(qwenputer).toContain('1800万命令を連続実行してエラーは0');
    expect(qwenputer).toContain('48.6％だった正答率を100％へ上げ');
    expect(qwenputer).toContain('画期的なのは');
    expect(qwenputer).toContain('言語モデルと決定論的な計算機を一体化する設計として重要な成果');
    expect(qwenputer.indexOf('1800万命令を連続実行してエラーは0'))
      .toBeLessThan(qwenputer.indexOf('現状はチェックポイント'));
    expect(qwenputer).not.toMatch(/第三者ベンチマークではありません。$/);
  });

  it('explains the collision sequence and failed protection instead of listing investigation methods', () => {
    const latestPlan = buildNarrationPlan(latestEdition, cast, 'VOICEVOX credit');
    const crash = latestPlan.segments
      .filter((segment) => segment.id.startsWith('rank-2'))
      .map((segment) => segment.text)
      .join(' ');
    expect(crash).toContain('停止していたIryoの高速列車へ、後方から運転を再開したRenfeのAVEが追突');
    expect(crash).toContain('LZBという主信号システムが約63キロの区間で停止');
    expect(crash).toContain('約40キロ毎時へ落とす手順');
    expect(crash).toContain('AVEには停止指示が出ないまま');
    expect(crash).not.toContain('運転記録装置の速度とブレーキ操作、信号と進路設定のログ');
  });

  it('requires a self-contained overview of the source article before deeper commentary', () => {
    for (const article of latestEdition.articles.filter((item) => item.top5Rank !== null)) {
      expect(article.narration?.result?.length).toBeGreaterThanOrEqual(60);
      const lead = buildNarrationPlan(latestEdition, cast, 'VOICEVOX credit').segments
        .find((segment) => segment.id === `rank-${article.top5Rank}`)!;
      const overviewLead = `${article.narration!.result!.split('。')[0]}。`;
      expect(lead.text).toContain(toBroadcastStyle(overviewLead));
    }

    const invalidEdition = structuredClone(latestEdition);
    invalidEdition.articles.find((article) => article.top5Rank === 1)!.narration!.result = undefined;
    expect(() => editionSchema.parse(invalidEdition)).toThrow(/中心事象/);
  });

  it('rejects enumerations that do not explain why the items matter', () => {
    const filler = '速度、信号、保守、運行判断を確認します。';
    expect(findBareEnumerations(filler)).toEqual([filler]);
    expect(() => assertNoBareEnumerations([{
      id: 'bare-list',
      speaker: cast[0],
      text: filler,
    }])).toThrow(/項目を並べただけ/);

    const meaningful = 'LZBは速度と列車間隔を連続監視し、管制は停止列車の情報を後続へ伝えます。今回は主系統の故障後に管制が通常走行を許可したため、二つの防護が追突を止められませんでした。';
    expect(findBareEnumerations(meaningful)).toEqual([]);
    expect(findBareEnumerations('更新、再ビルド、再配置、再起動までを一組として扱い、実行中のバイナリが修正版を使っているところまで確認するのが重要です。')).toEqual([]);
    expect(findBareEnumerations('外部URLを取得する機能や、圧縮されたリクエストを受け取るサービスは、入力がデコーダーへ届く経路を確認する必要があります。')).toEqual([]);
  });

  it('introduces unfamiliar companies and technical foundations before deal or implementation details', () => {
    const latestPlan = buildNarrationPlan(latestEdition, cast, 'VOICEVOX credit');
    const doorDashLead = latestPlan.segments.find((segment) => segment.id === 'rank-4')!.text;
    expect(doorDashLead).toContain('飲食店などの注文と配達員をつなぐ即時配達会社');
    expect(doorDashLead).toContain('店舗の商品を代わりに選んで届ける買い物代行');

    const qwenputerLead = latestPlan.segments.find((segment) => segment.id === 'rank-5')!.text;
    const qwenputerExplanation = latestPlan.segments.find((segment) => segment.id === 'rank-5-explanation')!.text;
    expect(qwenputerLead).toContain('通常の言語モデルは長い計算も文章と同じように答えを予測');
    expect(qwenputerLead).toContain('小さな仮想CPU');
    expect(qwenputerLead).toContain('物理的なCPUチップを入れたのではなく');
    expect(qwenputerExplanation).toContain('CPUが理解する命令の種類と形式を定めた公開仕様');
    expect(qwenputerExplanation).toContain('Cで書いたプログラムはRISC-Vの機械語へ変換');
    expect(doorDashLead).not.toContain('結びたのだ');
    expect(doorDashLead).toContain('結んだのだ');
  });
});
