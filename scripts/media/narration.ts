import type { Article, Edition } from '../../src/lib/schema';
import { formatFollowUpLabel } from '../../src/lib/follow-up';

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

  assertPoliteNarration(segments);

  return {
    date: edition.date,
    title: `${spokenDate} 毎日の注目記事 Top 5`,
    credit,
    segments,
  };
}

function buildArticleSegments(article: Article, rank: number, speakers: CastMember[]): NarrationSegment[] {
  const reaction = applyOpeningTone(
    toBroadcastStyle(formatReactionForNarration(article.attentionAnalysis.currentReaction)),
    speakers[0].name,
  );
  const sections = dedupeSections([
    {
      id: `rank-${rank}`,
      text: [
        article.followUp ? `${formatFollowUpLabel(article)}です。` : undefined,
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
        ...(article.narration?.anticipatedQuestions.map(formatAnticipatedInsight) ?? []),
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
    toBroadcastStyle(formatReactionForNarration(article.attentionAnalysis.currentReaction)),
    speakerName,
  );
  const body = dedupeSentences([
    article.summary[0],
    article.attentionAnalysis.whyNotable,
    ...(article.narration?.detail ?? []),
    ...(article.narration?.learning ?? []),
    ...(article.narration?.analysis ?? []),
    ...(article.narration?.anticipatedQuestions.map(formatAnticipatedInsight) ?? []),
  ].join(' '));

  const narration = [
    article.followUp ? `${formatFollowUpLabel(article)}です。` : undefined,
    `${article.title}。`,
    reaction,
    article.narration?.result,
    toBroadcastStyle(body),
  ].filter(Boolean).join(' ');
  return applySpeakerTone(narration, speakerName);
}

function formatAnticipatedInsight(item: { question: string; answer: string }) {
  return item.answer;
}

export function formatReactionForNarration(text: string) {
  return text.replace(
    /^(.+?)で(.+?)を\d{4}年\d{1,2}月\d{1,2}日\d{1,2}時\d{1,2}分に確認(?:した|しました)。$/,
    '$1では、今朝の時点で$2です。',
  );
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
  const endings: Array<[RegExp, string]> = [
    [/確認する必要があります。$/, '確認する必要があるのだ。'],
    [/判断できます。$/, '判断できるのだ。'],
    [/してください。$/, 'してほしいのだ。'],
    [/ています。$/, 'ているのだ。'],
    [/できます。$/, 'できるのだ。'],
    [/なります。$/, 'なるのだ。'],
    [/あります。$/, 'あるのだ。'],
    [/ました。$/, 'たのだ。'],
    [/でした。$/, 'だったのだ。'],
    [/です。$/, 'なのだ。'],
    [/だ。$/, 'なのだ。'],
    [/(る|た|ない|よい|しい|たい)。$/, '$1のだ。'],
  ];
  for (const [pattern, replacement] of endings) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  return text;
}

export function toBroadcastStyle(text: string) {
  const spokenCountryNames: Array<[RegExp, string]> = [
    [/米国エネルギー省/g, 'アメリカのエネルギー省'],
    [/米国内/g, 'アメリカ国内'],
    [/英国内/g, 'イギリス国内'],
    [/日米関係/g, '日本とアメリカの関係'],
    [/日米同盟/g, '日本とアメリカの同盟'],
    [/米中関係/g, 'アメリカと中国の関係'],
    [/米中競争/g, 'アメリカと中国の競争'],
    [/米英関係/g, 'アメリカとイギリスの関係'],
    [/日米/g, '日本とアメリカ'],
    [/米中/g, 'アメリカと中国'],
    [/米英/g, 'アメリカとイギリス'],
    [/日英/g, '日本とイギリス'],
    [/米国/g, 'アメリカ'],
    [/英国/g, 'イギリス'],
    [/米(?=政府|軍|企業|当局|議会|大統領|市場|国内|側)/g, 'アメリカ'],
    [/英(?=政府|軍|企業|当局|議会|首相|市場|国内|側)/g, 'イギリス'],
  ];
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
    [/発表した。/g, '発表しました。'],
    [/延ばした。/g, '延ばしました。'],
    [/加えた。/g, '加えました。'],
    [/持っていた。/g, '持っていました。'],
    [/方針を選んだ。/g, '方針を選びました。'],
    [/問われた。/g, '問われました。'],
    [/案内した。/g, '案内しました。'],
    [/整理した。/g, '整理しました。'],
    [/集まった。/g, '集まりました。'],
    [/疑問が出た。/g, '疑問が出ました。'],
    [/論点になった。/g, '論点になりました。'],
    [/始まった。/g, '始まりました。'],
    [/注目された。/g, '注目されました。'],
    [/議論された。/g, '議論されました。'],
    [/観察された。/g, '観察されました。'],
    [/公開された。/g, '公開されました。'],
    [/係留された。/g, '係留されました。'],
    [/案内されている。/g, '案内されています。'],
    [/共有されている。/g, '共有されています。'],
    [/議論されている。/g, '議論されています。'],
    [/広がっている。/g, '広がっています。'],
    [/議論している。/g, '議論しています。'],
    [/観察している。/g, '観察しています。'],
    [/調べている。/g, '調べています。'],
    [/見ている。/g, '見ています。'],
    [/指摘した。/g, '指摘しました。'],
    [/説明した。/g, '説明しました。'],
    [/確認した。/g, '確認しました。'],
    [/提示した。/g, '提示しました。'],
    [/追加した。/g, '追加しました。'],
    [/対象にした。/g, '対象にしました。'],
    [/報告した。/g, '報告しました。'],
    [/分析した。/g, '分析しました。'],
    [/応募した。/g, '応募しました。'],
    [/併存した。/g, '併存しました。'],
    [/併存できる。/g, '併存できます。'],
    [/絶滅危惧とした。/g, '絶滅危惧としました。'],
    [/現れた。/g, '現れました。'],
    [/取得できなかった。/g, '取得できませんでした。'],
    [/含まれる。/g, '含まれます。'],
    [/示される。/g, '示されます。'],
    [/左右される。/g, '左右されます。'],
    [/予定されている。/g, '予定されています。'],
    [/設計されている。/g, '設計されています。'],
    [/構成になっている。/g, '構成になっています。'],
    [/試されている。/g, '試されています。'],
    [/続けている。/g, '続けています。'],
    [/求めている。/g, '求めています。'],
    [/進んでいる。/g, '進んでいます。'],
    [/再配置していた。/g, '再配置していました。'],
    [/変換している。/g, '変換しています。'],
    [/位置付けている。/g, '位置付けています。'],
    [/リスクとしている。/g, 'リスクとしています。'],
    [/説明していない。/g, '説明していません。'],
    [/証明されていない。/g, '証明されていません。'],
    [/公表されていない。/g, '公表されていません。'],
    [/機能する。/g, '機能します。'],
    [/認証と認可を行う。/g, '認証と認可を行います。'],
    [/整える。/g, '整えます。'],
    [/決める。/g, '決めます。'],
    [/測る。/g, '測ります。'],
    [/分かれる。/g, '分かれます。'],
    [/検出される。/g, '検出されます。'],
    [/自動記録できる。/g, '自動記録できます。'],
    [/絞り込める。/g, '絞り込めます。'],
    [/比較できない。/g, '比較できません。'],
    [/単純移植できない。/g, '単純移植できません。'],
    [/見逃されやすい。/g, '見逃されやすいです。'],
    [/対象にする。/g, '対象にします。'],
    [/突き合わせる。/g, '突き合わせます。'],
    [/影響する。/g, '影響します。'],
    [/表示する。/g, '表示します。'],
    [/説明する。/g, '説明します。'],
    [/展開する。/g, '展開します。'],
    [/使う。/g, '使います。'],
    [/戻す。/g, '戻します。'],
    [/左右する。/g, '左右します。'],
    [/評価する。/g, '評価します。'],
    [/結論づけられない。/g, '結論づけられません。'],
    [/確定しない。/g, '確定しません。'],
    [/決まる。/g, '決まります。'],
    [/局面になる。/g, '局面になります。'],
    [/重要になる。/g, '重要になります。'],
    [/中心になる。/g, '中心になります。'],
    [/になる。/g, 'になります。'],
    [/可能性が高い。/g, '可能性が高いとみられます。'],
    [/点にある。/g, '点にあります。'],
    [/ことにある。/g, 'ことにあります。'],
    [/理由になった。/g, '理由になりました。'],
    [/強まる。/g, '強まります。'],
    [/欠かせない。/g, '欠かせません。'],
    [/始められる。/g, '始められます。'],
    [/難しい。/g, '難しいです。'],
    [/約30メートル長い。/g, '約30メートル長いです。'],
    [/ものだ。/g, 'ものです。'],
    [/変わる。/g, '変わります。'],
    [/異なる。/g, '異なります。'],
    [/関わる。/g, '関わります。'],
    [/広がる。/g, '広がります。'],
    [/つながる。/g, 'つながります。'],
    [/強くなる。/g, '強くなります。'],
    [/役立つ。/g, '役立ちます。'],
    [/焦点となる。/g, '焦点となります。'],
    [/根拠になる。/g, '根拠になります。'],
  ];
  const naturalCountryNames = spokenCountryNames.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text,
  );
  return endings.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), naturalCountryNames);
}

export function findPlainNarrationEndings(text: string) {
  const plainEnding = /[^。！？]*(?:(?<![まで])した|された|問われた|出た|った|ている|でいる|になる|がある|する|できる|される|られる|れる|める|える|せる|測る|決める|整える|る|ない|やすい|しい)。/g;
  return text.match(plainEnding)?.map((sentence) => sentence.trim()) ?? [];
}

export function assertPoliteNarration(segments: NarrationSegment[]) {
  const politeEnding = /(?:です|ます|ません|でした|ました|でしょう|ましょう|のだ|だったのだ)。$/;
  const violations = segments.flatMap((segment) => {
    const sentences = segment.text.split(/(?<=。)/).map((sentence) => sentence.trim()).filter(Boolean);
    return sentences.flatMap((sentence, index) => {
      const isTopicTitle = /^rank-\d+$/.test(segment.id) && index === 0;
      return !isTopicTitle && !politeEnding.test(sentence) ? [`${segment.id}: ${sentence}`] : [];
    });
  });
  if (violations.length) {
    throw new Error(`ニュース読みへ変換されていない常体の文末があります:\n${violations.join('\n')}`);
  }
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
