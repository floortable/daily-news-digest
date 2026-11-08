import rss from '@astrojs/rss';
import voicevox from '../../config/voicevox.json';
import { getAllArticles } from '../lib/data';
import { escapeXml, getRssMetadata, preserveRssGuids, toRssItem } from '../lib/rss';

export async function GET(context: { site?: URL }) {
  const articles = getAllArticles();
  const metadata = getRssMetadata(context.site, 'rss.xml', articles);
  const response = await rss({
    title: 'Daily News Digest',
    description: `毎朝の重要ニュース。音声版: ${voicevox.credit}`,
    ...metadata,
    items: articles.map((article) => ({
      ...toRssItem(article),
      customData: `<source-url>${escapeXml(article.sourceUrl)}</source-url>`,
    })),
  });
  return preserveRssGuids(response, articles, metadata.site);
}
