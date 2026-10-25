import type { Article, Edition } from '../../src/lib/schema';

export type CastMember = {
  name: string;
  style: string;
  speedScale: number;
  volumeScale?: number;
};

export type NarrationSegment = {
  id: string;
  speaker: CastMember;
  text: string;
};

export type NarrationPlan = {
  date: string;
  title: string;
  credit: string;
  segments: NarrationSegment[];
};

export function buildNarrationPlan(
  edition: Edition,
  cast: CastMember[],
  credit: string,
): NarrationPlan {
  if (cast.length !== 3) throw new Error('キャスターは3人設定してください');

  const top5 = edition.articles
    .filter((article) => article.top5Rank !== null)
    .sort((a, b) => a.top5Rank! - b.top5Rank!);
  if (top5.length !== 5) throw new Error(`${edition.date}: Top 5が5件ではありません`);

  const offset = Number(edition.date.replaceAll('-', '')) % cast.length;
  const speakerAt = (index: number) => cast[(offset + index) % cast.length];
  const spokenDate = new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'long',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(`${edition.date}T12:00:00+09:00`));

  const segments: NarrationSegment[] = [
    {
      id: 'opening',
      speaker: speakerAt(0),
      text: `${spokenDate}、デイリーニュースダイジェスト、今日のトップファイブ${speakerAt(0).name === 'ずんだもん' ? 'なのだ' : 'です'}。${speakerAt(0).name}、${speakerAt(1).name}、${speakerAt(2).name}の3人でお伝えします。`,
    },
  ];

  for (const [index, article] of top5.entries()) {
    const rank = index + 1;
    const speaker = speakerAt(index);
    segments.push({
      id: `rank-${rank}`,
      speaker,
      text: buildArticleNarration(article, rank, speaker.name),
    });
  }

  segments.push({
    id: 'closing',
    speaker: speakerAt(2),
    text: `以上、今日のトップファイブ${speakerAt(2).name === 'ずんだもん' ? 'なのだ' : 'でした'}。詳しい内容と元記事は、デイリーニュースダイジェストのRSSとサイトで確認できます。`,
  });

  return {
    date: edition.date,
    title: `${spokenDate} 毎日の注目記事 Top 5`,
    credit,
    segments,
  };
}

export function buildArticleNarration(article: Article, rank: number, speakerName: string) {
  const attentionLead = speakerName === 'ずんだもん'
    ? 'まずは、どれくらい話題なのか見ていくのだ。'
    : speakerName === '満別花丸'
      ? 'はじめに、現在の注目度を見てみましょう。'
      : 'まず、現在の反響と注目度から確認します。';
  const contentLead = speakerName === 'ずんだもん' ? 'では、内容を見ていくよ。' : '続いて、内容です。';
  const magnitude = describeReactionMagnitude(article);
  const reaction = toBroadcastStyle(article.attentionAnalysis.currentReaction);
  const assessmentComment = toBroadcastStyle(
    article.attentionAnalysis.assessmentComment.replace(article.attentionAnalysis.currentReaction, '').trim(),
  );
  const body = dedupeSentences([...article.summary, article.comment].join(' '));

  return [
    `第${rank}位。${article.title}。`,
    attentionLead,
    reaction,
    magnitude,
    describeAssessment(article.attentionAnalysis.assessment),
    assessmentComment,
    contentLead,
    toBroadcastStyle(body),
  ].filter(Boolean).join(' ');
}

function describeAssessment(assessment: Article['attentionAnalysis']['assessment']) {
  if (assessment === '評価が分かれる') return '注目度については、評価が分かれています。';
  if (assessment === '判断には早い') return '注目度を判断するには、まだ早い状況です。';
  return `注目度の評価は、${assessment}です。`;
}

export function toBroadcastStyle(text: string) {
  const endings: Array<[RegExp, string]> = [
    [/議論が大きい。/g, '議論が大きく広がっています。'],
    [/ではない。/g, 'ではありません。'],
    [/必要がある。/g, '必要があります。'],
    [/必要になる。/g, '必要になります。'],
    [/限界がある。/g, '限界があります。'],
    [/価値がある。/g, '価値があります。'],
    [/がある。/g, 'があります。'],
    [/である。/g, 'です。'],
    [/だった。/g, 'でした。'],
    [/報じられた。/g, '報じられました。'],
    [/公開された。/g, '公開されました。'],
    [/案内されている。/g, '案内されています。'],
    [/共有されている。/g, '共有されています。'],
    [/議論されている。/g, '議論されています。'],
    [/広がっている。/g, '広がっています。'],
    [/議論している。/g, '議論しています。'],
    [/観察している。/g, '観察しています。'],
    [/調べている。/g, '調べています。'],
    [/見ている。/g, '見ています。'],
    [/指摘した。/g, '指摘しました。'],
    [/報告した。/g, '報告しました。'],
    [/分析した。/g, '分析しました。'],
    [/評価する。/g, '評価します。'],
    [/結論づけられない。/g, '結論づけられません。'],
    [/変わる。/g, '変わります。'],
    [/異なる。/g, '異なります。'],
    [/関わる。/g, '関わります。'],
    [/広がる。/g, '広がります。'],
    [/役立つ。/g, '役立ちます。'],
    [/焦点となる。/g, '焦点となります。'],
    [/根拠になる。/g, '根拠になります。'],
  ];
  return endings.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);
}

function dedupeSentences(text: string) {
  const seen = new Set<string>();
  return text.split(/(?<=。)/).map((sentence) => sentence.trim()).filter((sentence) => {
    if (!sentence || seen.has(sentence)) return false;
    seen.add(sentence);
    return true;
  }).join(' ');
}

export function describeReactionMagnitude(article: Article) {
  const metrics = article.metrics;
  if (!metrics) return '';
  const values = [
    metrics.hatenaBookmarks, metrics.hnPoints, metrics.hnComments, metrics.togetterViews,
    metrics.redditScore, metrics.redditComments, metrics.fourChanReplies,
  ].filter((value): value is number => typeof value === 'number');
  if (!values.length) return '';
  const large = (metrics.hatenaBookmarks ?? 0) >= 100
    || (metrics.hnPoints ?? 0) >= 200 || (metrics.hnComments ?? 0) >= 100
    || (metrics.togetterViews ?? 0) >= 100_000
    || (metrics.redditScore ?? 0) >= 1_000 || (metrics.redditComments ?? 0) >= 200
    || (metrics.fourChanReplies ?? 0) >= 300;
  if (large) return '確認できた公開数値の範囲では、反響は大きいと言えます。';
  return '確認できた公開数値の範囲では、反響はまだ大きくありません。';
}
