import type { Edition } from '../../src/lib/schema';

export type CastMember = {
  name: string;
  style: string;
  speedScale: number;
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
      text: `${spokenDate}、デイリーニュースダイジェスト、今日のトップファイブです。${speakerAt(0).name}、${speakerAt(1).name}、${speakerAt(2).name}の3人でお伝えします。`,
    },
  ];

  for (const [index, article] of top5.entries()) {
    const rank = index + 1;
    segments.push({
      id: `rank-${rank}`,
      speaker: speakerAt(index),
      text: `第${rank}位。${article.title}。${article.summary.join(' ')} 解説です。${article.comment} 注目度について。${article.attentionAnalysis.currentReaction} 評価は、${article.attentionAnalysis.assessment}。${article.attentionAnalysis.assessmentComment}`,
    });
  }

  segments.push({
    id: 'closing',
    speaker: speakerAt(2),
    text: `以上、今日のトップファイブでした。詳しい内容と元記事は、デイリーニュースダイジェストのRSSとサイトで確認できます。`,
  });

  return {
    date: edition.date,
    title: `${spokenDate} 毎日の注目記事 Top 5`,
    credit,
    segments,
  };
}
