import rss from '@astrojs/rss';
import { getAllArticles } from '../../lib/data';
import { getRssMetadata, toRssItem } from '../../lib/rss';

export async function GET(context: { site?: URL }) {
  const articles = getAllArticles().filter((article) =>
    article.categories.includes('VCF・VMware・競合'),
  );
  return rss({
    title: 'Daily News Digest — VCF',
    description: 'VMware・VCF・競合ニュース',
    ...getRssMetadata(context.site, 'rss/vcf.xml', articles),
    items: articles.map(toRssItem),
  });
}
