import { getEditions } from '../../lib/data';
import { escapeXml } from '../../lib/rss';
import { getMediaUrls, isMediaPublished } from '../../lib/media';

export function GET(context: { site?: URL }) {
  if (!context.site) throw new Error('RSSのsite URLが設定されていません');
  const site = new URL(import.meta.env.BASE_URL, context.site);
  const items = getEditions().filter((edition) => isMediaPublished(edition.date)).map((edition) => {
    const media = getMediaUrls(site.href, edition.date);
    const top5 = edition.articles.filter((article) => article.top5Rank !== null).sort((a, b) => a.top5Rank! - b.top5Rank!);
    const page = new URL(`archive/${edition.date}/`, site).href;
    return `<item><title>${escapeXml(`${edition.date} 毎日の注目記事 Top 5`)}</title><link>${escapeXml(page)}</link><guid isPermaLink="true">${escapeXml(page)}#audio</guid><pubDate>${new Date(edition.generatedAt).toUTCString()}</pubDate><description>${escapeXml(top5.map((article) => `${article.top5Rank}. ${article.title}`).join(' / '))}</description><enclosure url="${escapeXml(media.audio)}" length="0" type="audio/mp4" /><itunes:author>VOICEVOX:満別花丸、VOICEVOX:ずんだもん、VOICEVOX:四国めたん</itunes:author></item>`;
  }).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>Daily News Digest — Top 5音声</title><link>${escapeXml(site.href)}</link><description>毎日のTop 5ながら聞き版</description><language>ja</language><atom:link href="${escapeXml(new URL('rss/audio.xml', site).href)}" rel="self" type="application/rss+xml" />${items}</channel></rss>`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
