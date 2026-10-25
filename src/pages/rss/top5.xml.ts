import rss from '@astrojs/rss';
import { getAllArticles } from '../../lib/data';
import { getRssMetadata, preserveRssGuids, toRssItem } from '../../lib/rss';

export async function GET(context: { site?: URL }) {
  const articles = getAllArticles().filter((article) => article.top5Rank !== null);
  const metadata = getRssMetadata(context.site, 'rss/top5.xml', articles);
  const response = await rss({
    title: 'Daily News Digest — Top 5',
    description: '毎日のTop 5',
    ...metadata,
    items: articles.map(toRssItem),
  });
  return preserveRssGuids(response, articles, metadata.site);
}
