import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

const configSchema = z.object({
  version: z.number().int().positive(),
  maxCandidates: z.number().int().positive().max(100),
  feeds: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    label: z.string().min(1),
    adapter: z.enum(['hn-algolia', 'cisa-kev', 'rss', 'discourse']),
    url: z.url(),
    maxCandidates: z.number().int().positive().max(100),
    minimumEngagementScore: z.number().int().nonnegative().optional(),
  }).strict()).min(1),
}).strict();

export type Candidate = {
  sourceId: string;
  sourceLabel: string;
  title: string;
  url: string;
  publishedAt: string | null;
  observedMetric: string | null;
  engagementScore?: number;
};

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const decodeXml = (value: string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function normalizeDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseFeed(adapter: string, body: string, sourceId: string, sourceLabel: string): Candidate[] {
  if (adapter === 'hn-algolia') {
    const data = JSON.parse(body) as { hits?: Array<Record<string, unknown>> };
    return (data.hits ?? []).flatMap((hit) => {
      const title = text(hit.title);
      const url = text(hit.url) || (hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : '');
      if (!title || !url) return [];
      const points = typeof hit.points === 'number' ? hit.points : null;
      const comments = typeof hit.num_comments === 'number' ? hit.num_comments : null;
      return [{ sourceId, sourceLabel, title, url, publishedAt: normalizeDate(hit.created_at), observedMetric:
        points === null && comments === null ? null : `${points ?? 0} points / ${comments ?? 0} comments`,
      engagementScore: (points ?? 0) + (comments ?? 0) * 2 }];
    });
  }
  if (adapter === 'cisa-kev') {
    const data = JSON.parse(body) as { vulnerabilities?: Array<Record<string, unknown>> };
    return (data.vulnerabilities ?? []).flatMap((item) => {
      const title = [text(item.cveID), text(item.vulnerabilityName)].filter(Boolean).join(' ');
      if (!title) return [];
      return [{ sourceId, sourceLabel, title, url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
        publishedAt: normalizeDate(item.dateAdded), observedMetric: text(item.dueDate) ? `due ${text(item.dueDate)}` : null }];
    });
  }
  if (adapter === 'discourse') {
    const data = JSON.parse(body) as { topic_list?: { topics?: Array<Record<string, unknown>> } };
    return (data.topic_list?.topics ?? []).flatMap((topic) => {
      const title = text(topic.title);
      const slug = text(topic.slug);
      const id = typeof topic.id === 'number' ? topic.id : null;
      if (!title || !slug || id === null) return [];
      return [{ sourceId, sourceLabel, title, url: `https://discuss.rubyonrails.org/t/${slug}/${id}`,
        publishedAt: normalizeDate(topic.created_at), observedMetric: typeof topic.posts_count === 'number' ? `${topic.posts_count} posts` : null }];
    });
  }
  const blocks = [...body.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)].map((match) => match[0]);
  return blocks.flatMap((block) => {
    const title = decodeXml(block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    const link = decodeXml(block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1]
      ?? block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? '');
    const published = block.match(/<(?:pubDate|published|updated|dc:date)\b[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/i)?.[1];
    return title && link ? [{ sourceId, sourceLabel, title, url: link, publishedAt: normalizeDate(decodeXml(published ?? '')), observedMetric: null }] : [];
  });
}

function dateArgument() {
  const index = process.argv.indexOf('--date');
  return index >= 0 ? process.argv[index + 1] : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
}

async function main() {
  const date = dateArgument();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('--date は YYYY-MM-DD 形式で指定してください');
  const config = configSchema.parse(JSON.parse(await readFile(resolve('config/candidate-feeds.json'), 'utf8')));
  const start = new Date(`${date}T07:00:00+09:00`);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${date}T07:00:00+09:00`);
  const results = await Promise.all(config.feeds.map(async (feed) => {
    try {
      const requestUrl = new URL(feed.url);
      if (feed.adapter === 'hn-algolia') {
        requestUrl.searchParams.set('numericFilters', `created_at_i>=${Math.floor(start.getTime() / 1000)},created_at_i<${Math.floor(end.getTime() / 1000)}`);
        requestUrl.searchParams.set('hitsPerPage', '500');
      }
      const response = await fetch(requestUrl, { headers: { 'user-agent': 'floortable-daily-news-digest/1.0' }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const candidates = parseFeed(feed.adapter, await response.text(), feed.id, feed.label)
        .filter((item) => !item.publishedAt || (new Date(item.publishedAt) >= start && new Date(item.publishedAt) < end))
        .filter((item) => feed.minimumEngagementScore === undefined || (item.engagementScore ?? 0) >= feed.minimumEngagementScore)
        .sort((a, b) => (b.engagementScore ?? 0) - (a.engagementScore ?? 0)
          || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
        .slice(0, feed.maxCandidates);
      return { feed: { id: feed.id, label: feed.label, url: feed.url }, status: 'checked' as const, error: null, candidates };
    } catch (error) {
      return { feed: { id: feed.id, label: feed.label, url: feed.url }, status: 'failed' as const,
        error: error instanceof Error ? error.message : String(error), candidates: [] as Candidate[] };
    }
  }));
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  const longest = Math.max(0, ...results.map((result) => result.candidates.length));
  for (let index = 0; index < longest && candidates.length < config.maxCandidates; index += 1) {
    for (const result of results) {
      const item = result.candidates[index];
      if (!item) continue;
      const key = `${item.title.toLowerCase().replace(/\s+/g, ' ')}\u0000${item.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(item);
      if (candidates.length >= config.maxCandidates) break;
    }
  }
  const output = { version: 1, date, window: { start: start.toISOString(), end: end.toISOString() }, generatedAt: new Date().toISOString(),
    feeds: results.map(({ feed, status, error, candidates: items }) => ({ ...feed, status, error, candidateCount: items.length })), candidates };
  const directory = resolve('generated/candidates');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `${date}.json`), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ date, feeds: results.length, failedFeeds: results.filter((item) => item.status === 'failed').map((item) => item.feed.id), candidates: candidates.length }));
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
