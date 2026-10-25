import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editionSchema } from '../src/lib/schema';
import { preserveRssGuids, toRssItem } from '../src/lib/rss';

describe('full-text RSS item', () => {
  const edition = editionSchema.parse(
    JSON.parse(readFileSync('data/daily/2026-10-25.json', 'utf8')),
  );
  const article = edition.articles[0];
  const item = toRssItem(article);

  it('links directly to the original article', () => {
    expect(item.link).toBe(article.sourceUrl);
  });

  it('contains all reader-facing editorial sections', () => {
    expect(item.content).toContain('<h2>要約</h2>');
    expect(item.content).toContain('<h2>解説</h2>');
    expect(item.content).toContain('<h2>注目度と反響</h2>');
    expect(item.content).toContain(article.summary[0]);
    expect(item.content).toContain(article.comment);
    expect(item.content).toContain(article.attentionAnalysis.whyNotable);
    expect(item.content).toContain(article.attentionAnalysis.currentReaction);
    expect(item.content).toContain(article.attentionAnalysis.assessmentComment);
  });

  it('keeps the site article URL as the stable RSS identifier', async () => {
    const generated = new Response(
      `<item><link>${article.sourceUrl}</link><guid isPermaLink="true">${article.sourceUrl}</guid></item>`,
    );
    const result = await preserveRssGuids(
      generated,
      [article],
      new URL('https://floortable.github.io/daily-news-digest/'),
    );
    const xml = await result.text();
    expect(xml).toContain(`<link>${article.sourceUrl}</link>`);
    expect(xml).toContain(
      `<guid isPermaLink="true">https://floortable.github.io/daily-news-digest/articles/${article.id}/</guid>`,
    );
  });
});
