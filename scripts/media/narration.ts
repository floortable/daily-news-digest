import type { Article, Edition } from '../../src/lib/schema';

export type CastMember = {
  name: string;
  style: string;
  speedScale: number;
  volumeScale?: number;
  intonationScale?: number;
  deEsser?: {
    intensity: number;
    maxReduction: number;
    frequency: number;
  };
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
  spokenCredit = '',
): NarrationPlan {
  if (cast.length < 3) throw new Error('キャスターは3人以上設定してください');

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
      text: `${spokenDate}、デイリーニュースダイジェスト、今日のトップファイブ${speakerAt(0).name === 'ずんだもん' ? 'なのだ' : 'です'}。${cast.map((member) => member.name).join('、')}の${cast.length}人でお伝えします。`,
    },
  ];

  for (const [index, article] of top5.entries()) {
    const rank = index + 1;
    const articleOffset = index;
    const articleSpeakers = [
      speakerAt(articleOffset),
      speakerAt(articleOffset + 1),
      speakerAt(articleOffset + 2),
    ];
    segments.push(...buildArticleSegments(article, rank, articleSpeakers));
  }

  segments.push({
    id: 'closing',
    speaker: speakerAt(2),
    text: `以上、今日のトップファイブ${speakerAt(2).name === 'ずんだもん' ? 'なのだ' : 'でした'}。詳しい内容と元記事は、デイリーニュースダイジェストのRSSとサイトで確認できます。${spokenCredit}`,
  });

  return {
    date: edition.date,
    title: `${spokenDate} 毎日の注目記事 Top 5`,
    credit,
    segments,
  };
}

function buildArticleSegments(article: Article, rank: number, speakers: CastMember[]): NarrationSegment[] {
  const reaction = applyOpeningTone(
    toBroadcastStyle(article.attentionAnalysis.currentReaction),
    speakers[0].name,
  );
  const sections = dedupeSections([
    {
      id: `rank-${rank}`,
      text: [
        `${article.title}。`,
        reaction,
        article.narration?.result,
      ].filter(Boolean).join(' '),
    },
    {
      id: `rank-${rank}-explanation`,
      text: [
        ...(article.narration?.detail ?? []),
        ...(article.narration?.learning ?? []),
      ].join(' '),
    },
    {
      id: `rank-${rank}-perspective`,
      text: [
        ...(article.narration?.analysis ?? []),
        ...(article.narration?.anticipatedQuestions.map(formatAnticipatedQuestion) ?? []),
      ].join(' '),
    },
  ]).filter((section) => section.text);

  return sections.map((section, index) => ({
    id: section.id,
    speaker: speakers[index],
    text: applySpeakerTone(toBroadcastStyle(section.text), speakers[index].name),
  }));
}

function dedupeSections<T extends { text: string }>(sections: T[]) {
  const seen = new Set<string>();
  return sections.map((section) => ({
    ...section,
    text: dedupeSentences(section.text, seen),
  }));
}

export function buildArticleNarration(article: Article, speakerName: string) {
  const reaction = applyOpeningTone(
    toBroadcastStyle(article.attentionAnalysis.currentReaction),
    speakerName,
  );
  const body = dedupeSentences([
    article.summary[0],
    article.attentionAnalysis.whyNotable,
    ...(article.narration?.detail ?? []),
    ...(article.narration?.learning ?? []),
    ...(article.narration?.analysis ?? []),
    ...(article.narration?.anticipatedQuestions.map(formatAnticipatedQuestion) ?? []),
  ].join(' '));

  const narration = [
    `${article.title}。`,
    reaction,
    article.narration?.result,
    toBroadcastStyle(body),
  ].filter(Boolean).join(' ');
  return applySpeakerTone(narration, speakerName);
}

function formatAnticipatedQuestion(item: { question: string; answer: string }, index: number) {
  const leads = ['ここで気になるのは', 'もう一つ、確認しておきたいのは', 'さらに実用面では'];
  return `${leads[index] ?? leads[2]}、${stripFinalPunctuation(item.question)}という点です。${item.answer}`;
}

function stripFinalPunctuation(text: string) {
  return text.replace(/[。？！?！]+$/, '');
}

function applyOpeningTone(text: string, speakerName: string) {
  if (speakerName !== 'ずんだもん') return text;
  return text
    .replace(/されています。$/, 'されているのだ。')
    .replace(/っています。$/, 'っているのだ。')
    .replace(/ています。$/, 'ているのだ。')
    .replace(/です。$/, 'なのだ。');
}

function applySpeakerTone(text: string, speakerName: string) {
  if (speakerName !== 'ずんだもん') return text;
  if (text.endsWith('のだ。')) return text;
  if (text.endsWith('判断できます。')) return text.replace(/判断できます。$/, '判断できるのだ。');
  if (text.endsWith('確認する必要があります。')) {
    return text.replace(/確認する必要があります。$/, '確認する必要があるのだ。');
  }
  return `${text} ここが、この話題を見るうえでのポイントなのだ。`;
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

function dedupeSentences(text: string, seen = new Set<string>()) {
  const boilerplate = new Set([
    '原文の更新、反対意見、対象範囲を継続して確認し、単一の数値や印象だけで結論を固定しないことが重要である。',
    '読者にとっては、確認済みの事実と発表者の評価を分け、実生活や業務への影響、未確定点、次に見るべき資料を整理することが大切である。',
  ]);
  return text.split(/(?<=。)/).map((sentence) => sentence.trim()).filter((sentence) => {
    if (!sentence || seen.has(sentence) || boilerplate.has(sentence)) return false;
    seen.add(sentence);
    return true;
  }).join(' ');
}
