import { getEditions } from './data';
import { getMediaUrls, getPublishedMedia, isMediaPublished } from './media';
import { escapeXml } from './rss';

const showTitle = '毎日の注目ニュース5選';
const showDescription = '毎日の注目ニュース5件を入口に、ソフトウェア・インフラ・AI・セキュリティに関心のあるエンジニアへ、背景、仕組み、周辺知識と今後を見る判断軸を届ける短い教養Podcastです。VOICEVOXによる合成音声を使用しています。';
const voiceCredit = 'VOICEVOX:満別花丸、VOICEVOX:ずんだもん、VOICEVOX:四国めたん、VOICEVOX:冥鳴ひまり';
const musicCredit = 'BGM・トピック切替SE制作／利用権管理: floortable（Suno有料プラン生成）';

export function buildPodcastFeed(contextSite: URL | undefined, basePath = import.meta.env.BASE_URL) {
  if (!contextSite) throw new Error('Podcast RSSのsite URLが設定されていません');
  const site = new URL(basePath, contextSite);
  const feedUrl = new URL('podcast.xml', site);
  const artworkUrl = new URL('podcast-cover.jpg', site);
  const editions = getEditions().filter((edition) => isMediaPublished(edition.date));
  const items = editions.map((edition) => {
    const media = getMediaUrls(site.href, edition.date);
    const published = getPublishedMedia(edition.date)!;
    const top5 = edition.articles
      .filter((article) => article.top5Rank !== null)
      .sort((a, b) => a.top5Rank! - b.top5Rank!);
    const page = new URL(`archive/${edition.date}/`, site).href;
    const episodeTitle = `${formatJapaneseDate(edition.date)}｜${showTitle}`;
    const topics = top5.map((article) => article.title).join('／');
    const description = `${topics}。ニュースの概要だけでなく、背景と仕組み、異なる視点まで解説します。VOICEVOXによる合成音声を使用しています。${voiceCredit}。${musicCredit}。`;
    const showNotes = [
      `<p>${escapeXml(description)}</p>`,
      '<h2>取り上げたニュースと出典</h2>',
      `<ol>${top5.map((article) => `<li><a href="${escapeXml(article.sourceUrl)}">${escapeXml(article.title)}</a>（${escapeXml(article.sourceName)}）</li>`).join('')}</ol>`,
      `<p><a href="${escapeXml(page)}">解説・追加資料・訂正履歴をサイトで確認</a></p>`,
      `<p>${escapeXml(voiceCredit)}<br>${escapeXml(musicCredit)}</p>`,
    ].join('');
    return [
      '<item>',
      `<title>${escapeXml(episodeTitle)}</title>`,
      `<itunes:title>${escapeXml(episodeTitle)}</itunes:title>`,
      `<link>${escapeXml(page)}</link>`,
      `<guid isPermaLink="true">${escapeXml(page)}#audio</guid>`,
      `<pubDate>${new Date(edition.generatedAt).toUTCString()}</pubDate>`,
      `<description>${escapeXml(description)}</description>`,
      `<content:encoded><![CDATA[${toCdata(showNotes)}]]></content:encoded>`,
      `<enclosure url="${escapeXml(media.audio)}" length="${published.audioBytes}" type="audio/mp4" />`,
      `<itunes:duration>${published.durationSeconds}</itunes:duration>`,
      '<itunes:episodeType>full</itunes:episodeType>',
      '<itunes:explicit>false</itunes:explicit>',
      '<itunes:author>floortable</itunes:author>',
      `<itunes:image href="${escapeXml(artworkUrl.href)}" />`,
      '</item>',
    ].join('');
  }).join('');
  const lastBuildDate = editions.length
    ? new Date(Math.max(...editions.map((edition) => new Date(edition.generatedAt).getTime()))).toUTCString()
    : new Date(0).toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${escapeXml(showTitle)}</title><link>${escapeXml(site.href)}</link><description>${escapeXml(showDescription)}</description><language>ja</language><lastBuildDate>${lastBuildDate}</lastBuildDate><generator>Daily News Digest</generator><copyright>&#xA9; 2026 floortable</copyright><itunes:author>floortable</itunes:author><itunes:summary>${escapeXml(showDescription)}</itunes:summary><itunes:type>episodic</itunes:type><itunes:explicit>false</itunes:explicit><itunes:image href="${escapeXml(artworkUrl.href)}" /><itunes:category text="News"><itunes:category text="Tech News" /></itunes:category><itunes:category text="Technology" /><itunes:owner><itunes:name>floortable</itunes:name><itunes:email>floortable@users.noreply.github.com</itunes:email></itunes:owner><atom:link href="${escapeXml(feedUrl.href)}" rel="self" type="application/rss+xml" />${items}</channel></rss>`;
}

function formatJapaneseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function toCdata(value: string) {
  return value.replaceAll(']]>', ']]]]><![CDATA[>');
}
