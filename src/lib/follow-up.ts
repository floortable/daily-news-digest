import type { Article } from './schema';

export function formatFollowUpLabel(article: Article) {
  if (!article.followUp) return '';
  const date = new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'long',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(`${article.followUp.originalEditionDate}T12:00:00+09:00`));
  return `${date}の記事${article.followUp.type === 'renewed-attention' ? 'が再燃' : 'の続報'}`;
}
