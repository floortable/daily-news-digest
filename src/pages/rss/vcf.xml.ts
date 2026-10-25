import rss from '@astrojs/rss';
import { getAllArticles } from '../../lib/data';
import { getRssMetadata, preserveRssGuids, toRssItem } from '../../lib/rss';

export async function GET(context: { site?: URL }) {
  const articles = getAllArticles().filter((article) =>
    article.categories.includes('VCF・VMware・競合'),
  );
  const metadata = getRssMetadata(context.site, 'rss/vcf.xml', articles);
  const response = await rss({
    title: 'Daily News Digest — VCF',
    description: 'VMware・VCF・競合ニュース',
    ...metadata,
    items: articles.map(toRssItem),
  });
  return preserveRssGuids(response, articles, metadata.site);
}
