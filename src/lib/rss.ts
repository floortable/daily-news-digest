import type { Article } from './schema';

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
    link: `articles/${article.id}/`,
    categories: article.categories,
  };
}

export function escapeXml(value: string) {
  return value.replace(
    /[<>&'"]/g,
    (character) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]!,
  );
}
