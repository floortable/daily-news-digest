import rss from '@astrojs/rss';
import { getAllArticles } from '../../lib/data';
import { getRssMetadata, toRssItem } from '../../lib/rss';

export async function GET(context: { site?: URL }) {
  const articles = getAllArticles().filter((article) => article.top5Rank !== null);
  return rss({
    title: 'Daily News Digest — Top 5',
    description: '毎日のTop 5',
    ...getRssMetadata(context.site, 'rss/top5.xml', articles),
    items: articles.map(toRssItem),
  });
}
