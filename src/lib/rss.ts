import type { Article } from './schema';
import { formatFollowUpLabel } from './follow-up';

export function getRssMetadata(contextSite: URL | undefined, feedPath: string, articles: Article[]) {
  if (!contextSite) throw new Error('RSSのsite URLが設定されていません');

  const site = new URL(import.meta.env.BASE_URL, contextSite);
  const self = new URL(feedPath, site);
  const lastBuildDate = articles.reduce(
    (latest, article) => Math.max(latest, new Date(article.publishedAt).getTime()),
    0,
  );

  return {
    site,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData:
      '<language>ja</language>' +
      `<lastBuildDate>${new Date(lastBuildDate).toUTCString()}</lastBuildDate>` +
      '<ttl>15</ttl>' +
      `<atom:link href="${escapeXml(self.href)}" rel="self" type="application/rss+xml" />`,
  };
}

export function toRssItem(article: Article) {
  return {
    title: article.title,
    pubDate: new Date(article.publishedAt),
    description: article.summary.join(' '),
    content: renderArticleContent(article),
    // RSSからサイトを一度経由せず、原文へ直接移動できるようにする。
    link: article.sourceUrl,
    categories: article.categories,
  };
}

export async function preserveRssGuids(response: Response, articles: Article[], site: URL) {
  let xml = await response.text();
  for (const article of articles) {
    const generatedGuid = `<guid isPermaLink="true">${escapeXml(article.sourceUrl)}</guid>`;
    const stableUrl = new URL(`articles/${article.id}/`, site).href;
    const stableGuid = `<guid isPermaLink="true">${escapeXml(stableUrl)}</guid>`;
    xml = xml.replace(generatedGuid, stableGuid);
  }
  return new Response(xml, { status: response.status, headers: response.headers });
}

export function renderArticleContent(article: Article) {
  const date = new Date(article.publishedAt).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const analysis = article.attentionAnalysis;
  const followUp = article.followUp
    ? `<p><strong>${escapeHtml(formatFollowUpLabel(article))}</strong></p>`
    : '';

  return [
    followUp,
    `<p><strong>配信元:</strong> ${escapeHtml(article.sourceName)} ／ <strong>公開:</strong> ${escapeHtml(date)} ／ <strong>情報種別:</strong> ${escapeHtml(article.informationType)}</p>`,
    `<p><strong>分野:</strong> ${article.categories.map(escapeHtml).join('、')}</p>`,
    '<h2>概要</h2>',
    ...article.summary.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    '<h2>解説</h2>',
    `<p>${escapeHtml(article.comment)}</p>`,
    renderDetailedExplanation(article),
    renderMediaTrend(article),
    '<h2>注目度と反響</h2>',
    `<h3>注目する理由</h3><p>${escapeHtml(analysis.whyNotable)}</p>`,
    `<h3>確認できた現在の反響</h3><p>${escapeHtml(analysis.currentReaction)}</p>`,
    `<h3>中立評価: ${escapeHtml(analysis.assessment)}</h3><p>${escapeHtml(analysis.assessmentComment)}</p>`,
    renderMetrics(article),
    `<p><a href="${escapeHtml(article.sourceUrl)}">元記事を直接開く ↗</a></p>`,
  ].join('');
}

function renderMediaTrend(article: Article) {
  const trend = article.mediaTrend;
  if (!trend) return '';
  const originLink = trend.origin.originalUrl
    ? `<p><a href="${escapeHtml(trend.origin.originalUrl)}">確認した元投稿を開く ↗</a></p>`
    : '';
  const materialList = (items: typeof trend.sourceMaterials) => items.length
    ? `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.title)}</strong>（${escapeHtml(item.kind)}・${escapeHtml(item.identificationStatus)}・${escapeHtml(item.rightsStatus)}）— ${escapeHtml(item.note)}${item.sourceUrl ? ` <a href="${escapeHtml(item.sourceUrl)}">根拠 ↗</a>` : ''}</li>`).join('')}</ul>`
    : '<p>個別の素材は確認できていません。</p>';
  return [
    '<h2>ミーム・流行動画の解説</h2>',
    `<p><strong>形式:</strong> ${trend.formats.map(escapeHtml).join('、')}</p>`,
    '<h3>発祥</h3>',
    `<p><strong>確認状態:</strong> ${escapeHtml(trend.origin.status)} ／ <strong>投稿先:</strong> ${escapeHtml(trend.origin.platform)} ／ <strong>投稿者:</strong> ${escapeHtml(trend.origin.creatorName ?? '未特定')}</p>`,
    `<p>${escapeHtml(trend.origin.explanation)}</p>`, originLink,
    '<h3>元ネタ・使用素材</h3>', `<p>${escapeHtml(trend.sourceMaterialAnalysis)}</p>`, materialList(trend.sourceMaterials),
    '<h3>BGM・音源</h3>', `<p>${escapeHtml(trend.musicAnalysis)}</p>`, materialList(trend.music),
    '<h3>拡散経路</h3>',
    `<ul>${trend.spread.map((item) => `<li><strong>${escapeHtml(item.platform)}</strong>（${escapeHtml(new Date(item.observedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }))}確認）— ${escapeHtml(item.evidence)}${item.exampleUrl ? ` <a href="${escapeHtml(item.exampleUrl)}">確認例 ↗</a>` : ''}</li>`).join('')}</ul>`,
    '<h3>反響と中立評価</h3>', `<p>${escapeHtml(trend.reactionSummary)}</p>`, `<p>${escapeHtml(trend.neutralAssessment)}</p>`,
    '<h3>権利・安全上の注意</h3>', `<p>${escapeHtml(trend.rightsAndSafety)}</p>`,
  ].join('');
}

function renderDetailedExplanation(article: Article) {
  const detail = article.articleDetail;
  if (detail) return [
    '<h2>結論</h2>', `<p>${escapeHtml(detail.conclusion)}</p>`,
    '<h2>何が分かったのか</h2>', ...detail.facts.map((item) => `<p>${escapeHtml(item)}</p>`),
    '<h2>背景</h2>', ...detail.background.map((item) => `<p>${escapeHtml(item)}</p>`),
    '<h2>基礎からの解説</h2>', ...detail.explanation.map((item) => `<p>${escapeHtml(item)}</p>`),
    '<h2>読者にとっての意味</h2>', ...detail.implications.map((item) => `<p>${escapeHtml(item)}</p>`),
    '<h2>注意点・未確定事項</h2>', ...detail.caveats.map((item) => `<p>${escapeHtml(item)}</p>`),
    '<h2>次に確認すること</h2>', `<ul>${detail.nextChecks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
  ].join('');
  if (!article.narration) return '';
  return [
    `<h2>結論</h2><p>${escapeHtml(article.narration.result ?? article.summary[0])}</p>`,
    '<h2>事実関係と背景</h2>', ...article.narration.detail.map((item) => `<p>${escapeHtml(item)}</p>`),
    '<h2>基礎からの解説</h2>', ...article.narration.learning.map((item) => `<p>${escapeHtml(item)}</p>`),
    '<h2>客観評価</h2>', ...article.narration.analysis.map((item) => `<p>${escapeHtml(item)}</p>`),
    '<h2>先回りして確認したいこと</h2>', ...article.narration.anticipatedQuestions.map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`),
  ].join('');
}

function renderMetrics(article: Article) {
  const metrics = article.metrics;
  if (!metrics) return '<p><strong>公開注目指標:</strong> 取得できる数値なし</p>';

  const labels: Array<[keyof typeof metrics, string]> = [
    ['hatenaBookmarks', 'はてなブックマーク'],
    ['hnPoints', 'Hacker News points'],
    ['hnComments', 'Hacker News comments'],
    ['togetterViews', 'Togetter views'],
    ['redditScore', 'Reddit score'],
    ['redditComments', 'Reddit comments'],
    ['fourChanReplies', '4chan replies'],
  ];
  const values = labels.flatMap(([key, label]) => {
    const value = metrics[key];
    return typeof value === 'number' ? [`${label}: ${value.toLocaleString('ja-JP')}`] : [];
  });
  if (!values.length) return '<p><strong>公開注目指標:</strong> 取得できる数値なし</p>';

  const checkedAt = metrics.socialMetricsCheckedAt
    ? `（${new Date(metrics.socialMetricsCheckedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}確認）`
    : '';
  return `<p><strong>公開注目指標:</strong> ${escapeHtml(values.join(' ／ '))}${escapeHtml(checkedAt)}</p>`;
}

export function escapeXml(value: string) {
  return value.replace(
    /[<>&'"]/g,
    (character) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]!,
  );
}

const escapeHtml = escapeXml;
