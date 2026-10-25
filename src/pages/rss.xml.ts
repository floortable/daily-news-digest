import rss from '@astrojs/rss';
import { getAllArticles } from '../lib/data';
import { escapeXml, getRssMetadata, toRssItem } from '../lib/rss';

export async function GET(context: { site?: URL }) {
  const articles = getAllArticles();
  return rss({
    title: 'Daily News Digest',
    description: '毎朝の重要ニュース',
    ...getRssMetadata(context.site, 'rss.xml', articles),
    items: articles.map((article) => ({
      ...toRssItem(article),
      customData: `<source-url>${escapeXml(article.sourceUrl)}</source-url>`,
    })),
  });
}
