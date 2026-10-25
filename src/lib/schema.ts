import { z } from 'zod';

export const categories = [
  '国内・国際', 'テクノロジー', '科学・医療', '生活・文化',
  'エンタメ', 'VCF・VMware・競合', 'セキュリティ', 'その他',
] as const;

const isoDateTime = z.iso.datetime({ offset: true });

export const articleSchema = z.object({
  id: z.string().regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/),
  title: z.string().min(1).max(180),
  sourceUrl: z.url().refine((url) => /^https?:\/\//.test(url), 'HTTP(S) URLが必要です'),
  sourceName: z.string().min(1).max(80),
  publishedAt: isoDateTime,
  collectedAt: isoDateTime,
  editionDate: z.iso.date(),
  categories: z.array(z.enum(categories)).min(1),
  channels: z.array(z.enum([
    'hatena', 'hacker-news', 'togetter', 'reddit', '4chan', 'social-other', 'other',
  ])).min(1),
  top5Rank: z.number().int().min(1).max(5).nullable(),
  narration: z.object({
    sourceCheckedAt: isoDateTime,
    result: z.string().min(20).max(500).optional(),
    detail: z.array(z.string().min(20).max(500)).min(1).max(4),
    learning: z.array(z.string().min(20).max(500)).min(1).max(4),
    analysis: z.array(z.string().min(20).max(500)).min(1).max(3),
    anticipatedQuestions: z.array(z.object({
      question: z.string().min(10).max(160),
      answer: z.string().min(20).max(500),
    }).strict()).min(1).max(3),
    references: z.array(z.url()).max(5).default([]),
  }).strict().optional(),
  summary: z.array(z.string().min(1).max(500)).min(2).max(3)
    .refine((paragraphs) => paragraphs.join('').length >= 140, '独自要約は合計140文字以上必要です'),
  comment: z.string().min(180, '独自解説は180文字以上必要です').max(1000),
  attentionAnalysis: z.object({
    whyNotable: z.string().min(20).max(240),
    currentReaction: z.string().min(20).max(240),
    assessment: z.enum(['過熱気味', '妥当', '注目不足', '評価が分かれる', '判断には早い']),
    assessmentComment: z.string().min(20).max(240),
  }).strict(),
  informationType: z.enum(['公式発表', '報道', '研究', '意見']),
  editorialReview: z.object({
    titleIsOriginal: z.literal(true),
    quotation: z.discriminatedUnion('used', [
      z.object({ used: z.literal(false) }).strict(),
      z.object({
        used: z.literal(true),
        text: z.string().min(1).max(300),
        sourceUrl: z.url(),
        attribution: z.string().min(1).max(200),
        purpose: z.string().min(30).max(300),
      }).strict(),
    ]),
    mediaAssets: z.array(z.object({
      url: z.url(),
      license: z.enum(['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'public-domain', 'explicit-permission']),
      attribution: z.string().min(1).max(300),
      licenseUrl: z.url().nullable(),
    }).strict()).max(3),
  }).strict(),
  metrics: z.object({
    hatenaBookmarks: z.number().int().nonnegative().optional(),
    hnPoints: z.number().int().nonnegative().optional(),
    hnComments: z.number().int().nonnegative().optional(),
    togetterViews: z.number().int().nonnegative().optional(),
    redditScore: z.number().int().nonnegative().optional(),
    redditComments: z.number().int().nonnegative().optional(),
    fourChanReplies: z.number().int().nonnegative().optional(),
    socialMetricsCheckedAt: isoDateTime.optional(),
  }).optional(),
  relatedArticleIds: z.array(z.string()).default([]),
  urlCheck: z.object({
    status: z.enum(['ok', 'restricted', 'failed']),
    checkedAt: isoDateTime,
    httpStatus: z.number().int().min(100).max(599).optional(),
    note: z.string().max(300).optional(),
  }).strict(),
}).strict();

export const editionSchema = z.object({
  date: z.iso.date(),
  generatedAt: isoDateTime,
  contentCompliance: z.object({
    policyVersion: z.literal(1),
    summariesAreOriginal: z.literal(true),
    copiedBody: z.literal(false),
    copiedImages: z.literal(false),
    quotationsReviewed: z.literal(true),
    sourceTermsReviewed: z.literal(true),
    explanationsReviewed: z.literal(true),
  }).strict(),
  articles: z.array(articleSchema).min(1),
}).strict().superRefine((edition, ctx) => {
  const ids = new Set<string>();
  const urls = new Set<string>();
  const ranks = new Set<number>();
  for (const [index, article] of edition.articles.entries()) {
    if (article.editionDate !== edition.date) ctx.addIssue({ code: 'custom', path: ['articles', index, 'editionDate'], message: '版の日付と一致しません' });
    if (ids.has(article.id)) ctx.addIssue({ code: 'custom', path: ['articles', index, 'id'], message: '記事IDが重複しています' });
    ids.add(article.id);
    const normalized = normalizeUrl(article.sourceUrl);
    if (urls.has(normalized)) ctx.addIssue({ code: 'custom', path: ['articles', index, 'sourceUrl'], message: '正規化後のURLが重複しています' });
    urls.add(normalized);
    if (article.top5Rank !== null) {
      if (ranks.has(article.top5Rank)) ctx.addIssue({ code: 'custom', path: ['articles', index, 'top5Rank'], message: 'Top 5順位が重複しています' });
      ranks.add(article.top5Rank);
    }
  }
  if ([1, 2, 3, 4, 5].some((rank) => !ranks.has(rank))) ctx.addIssue({ code: 'custom', path: ['articles'], message: 'Top 5の順位1〜5が必要です' });
});

export type Article = z.infer<typeof articleSchema>;
export type Edition = z.infer<typeof editionSchema>;

export function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, '');
  url.searchParams.sort();
  return url.toString();
}
