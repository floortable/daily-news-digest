import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editionSchema } from '../src/lib/schema';
import { escapeXml, preserveRssGuids, toRssItem } from '../src/lib/rss';

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
    expect(item.content).toContain('<h2>概要</h2>');
    expect(item.content).toContain('<h2>解説</h2>');
    expect(item.content).toContain('<h2>事実関係と背景</h2>');
    expect(item.content).toContain('<h2>基礎からの解説</h2>');
    expect(item.content).toContain('<h2>注目度と反響</h2>');
    expect(item.content).toContain(article.summary[0]);
    expect(item.content).toContain(article.comment);
    expect(item.content).toContain(escapeXml(article.narration!.detail[0]));
    expect(item.content).toContain(escapeXml(article.narration!.learning[0]));
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

  it('renders origin, materials, music, spread, reaction, and rights for media trends', () => {
    const trendArticle = structuredClone(article);
    trendArticle.categories = ['ネット文化・ミーム'];
    trendArticle.informationType = 'ミーム・ネット文化';
    trendArticle.mediaTrend = {
      formats: ['短尺動画'],
      origin: { status: '未特定', platform: 'TikTok', creatorName: null, accountHandle: null, originalUrl: null, postedAt: null, explanation: '転載が先行しており、確認できる公開投稿だけでは最初の投稿者と投稿時刻を特定できません。最古と断定せず未特定として扱います。' },
      sourceMaterialAnalysis: '映像の構図には既存作品との類似が指摘されていますが、制作者の説明を確認できないため元ネタを確定していません。',
      sourceMaterials: [],
      musicAnalysis: '動画に音声はありますが、公式クレジットと権利者情報を照合できず、曲名や作者を推測で記載していません。',
      music: [],
      spread: [{ platform: 'TikTok', observedAt: '2026-10-25T08:00:00+09:00', evidence: '同じ構図を使った複数の派生投稿が公開範囲で確認されました。', exampleUrl: null }],
      reactionSummary: '模倣投稿と元ネタを尋ねる反応が確認されていますが、取得可能な公開投稿だけの観測であり、利用者全体の反応とは扱いません。',
      neutralAssessment: '短期間の派生は確認できる一方、発祥と素材が未特定です。拡散規模だけを根拠に代表的な流行と断定せず、追加確認が必要です。',
      rightsAndSafety: '元動画、音声、画像はRSSへ転載せず、確認できた公開情報の説明だけを掲載します。削除済み投稿や非公開情報へアクセスせず、投稿者の特定も行いません。',
    };
    const content = toRssItem(trendArticle).content;
    expect(content).toContain('<h2>ミーム・流行動画の解説</h2>');
    expect(content).toContain('<h3>発祥</h3>');
    expect(content).toContain('<h3>元ネタ・使用素材</h3>');
    expect(content).toContain('<h3>BGM・音源</h3>');
    expect(content).toContain('<h3>拡散経路</h3>');
    expect(content).toContain('<h3>権利・安全上の注意</h3>');
  });
});
