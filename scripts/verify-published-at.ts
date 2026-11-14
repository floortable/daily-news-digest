/** 記事ページの一次資料表示時刻と publishedAt を照合する。 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

type Article = { id: string; sourceUrl: string; publishedAt: string };
export type PublishedAtResult = {
  id: string;
  publishedAt: string;
  extractedAt: string | null;
  verdict: 'match' | 'mismatch' | 'unverifiable';
  note?: string;
};
type FetchText = (url: string) => Promise<string>;

function jsonLdDates(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(jsonLdDates);
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return [
      ...(typeof record.datePublished === 'string' ? [record.datePublished] : []),
      ...Object.entries(record)
        .filter(([key]) => key !== 'datePublished')
        .flatMap(([, child]) => jsonLdDates(child)),
    ];
  }
  return [];
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] ?? null;
}

function isDateOnly(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
function hasTimeZone(value: string): boolean { return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value); }

/** Extract in source-order priority, preferring timezone-qualified timestamps globally. */
export function extractPublishedAt(html: string): string | null {
  const candidates: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { candidates.push(...jsonLdDates(JSON.parse(match[2]))); } catch { /* Ignore malformed structured data. */ }
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = attribute(tag, 'property') ?? attribute(tag, 'name');
    if (key && /^(article:published_time|og:published_time|datepublished|date\.published)$/i.test(key)) {
      const value = attribute(tag, 'content');
      if (value) candidates.push(value);
    }
  }
  const time = html.match(/<time\b[^>]*\bdatetime\s*=\s*(["'])(.*?)\1[^>]*>/i);
  if (time?.[2]) candidates.push(time[2]);
  return candidates.find(hasTimeZone) ?? candidates[0] ?? null;
}

function toJstDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function publishedAtVerdict(publishedAt: string, extractedAt: string | null): PublishedAtResult['verdict'] {
  if (!extractedAt) return 'unverifiable';
  if (isDateOnly(extractedAt)) return toJstDate(publishedAt) === extractedAt ? 'match' : 'mismatch';
  if (!hasTimeZone(extractedAt)) return 'unverifiable';
  const extracted = new Date(extractedAt);
  const published = new Date(publishedAt);
  if (Number.isNaN(extracted.getTime()) || Number.isNaN(published.getTime())) return 'unverifiable';
  return Math.abs(extracted.getTime() - published.getTime()) > 60 * 60 * 1000 ? 'mismatch' : 'match';
}

export async function verifyPublishedAt(articles: Article[], getText: FetchText): Promise<PublishedAtResult[]> {
  return Promise.all(articles.map(async (article) => {
    let extractedAt: string | null = null;
    let note: string | undefined;
    try {
      extractedAt = extractPublishedAt(await getText(article.sourceUrl));
      if (!extractedAt) note = 'no published timestamp extracted';
      else if (!isDateOnly(extractedAt) && !hasTimeZone(extractedAt)) note = 'timezone-less extracted timestamp';
    } catch {
      note = 'failed to fetch article page';
    }
    const verdict = publishedAtVerdict(article.publishedAt, extractedAt);
    return { id: article.id, publishedAt: article.publishedAt, extractedAt, verdict, ...(note ? { note } : {}) };
  }));
}

export const fetchText: FetchText = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DailyNewsDigest/1.0; +https://github.com/floortable/daily-news-digest)' },
    signal: AbortSignal.timeout(15_000), redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
};

function valueAfter(flag: string): string | undefined { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; }
async function main(): Promise<void> {
  const date = valueAfter('--date');
  const file = valueAfter('--file') ?? (date ? resolve(`data/daily/${date}.json`) : undefined);
  if (!file || (!date && !valueAfter('--file'))) throw new Error('使い方: verify-published-at.ts --date YYYY-MM-DD [--file PATH]');
  const raw = JSON.parse(await readFile(file, 'utf8'));
  const articles = z.array(z.object({ id: z.string(), sourceUrl: z.url(), publishedAt: z.iso.datetime({ offset: true }) })).parse(raw.articles);
  const results = await verifyPublishedAt(articles, fetchText);
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => result.verdict === 'mismatch')) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
