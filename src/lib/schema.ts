import { z } from 'zod';

export const categories = [
  '国内・国際', 'テクノロジー', '科学・医療', '生活・文化',
  'エンタメ', 'ネット文化・ミーム', 'VCF・VMware・競合', 'セキュリティ', 'その他',
] as const;

const isoDateTime = z.iso.datetime({ offset: true });

const articleDetailSchema = z.object({
  conclusion: z.string().min(40).max(500),
  facts: z.array(z.string().min(50).max(700)).min(2).max(4),
  background: z.array(z.string().min(50).max(700)).min(1).max(3),
  explanation: z.array(z.string().min(80).max(900)).min(1).max(3),
  implications: z.array(z.string().min(50).max(700)).min(1).max(3),
  caveats: z.array(z.string().min(40).max(700)).min(1).max(3),
  nextChecks: z.array(z.string().min(30).max(500)).min(1).max(3),
}).strict();

const trendMaterialSchema = z.object({
  kind: z.enum(['動画', '画像', '音楽', '音声', '映画・番組', 'ゲーム', '投稿', 'その他']),
  title: z.string().min(1).max(240),
  creator: z.string().min(1).max(160).nullable(),
  sourceUrl: z.url().nullable(),
  identificationStatus: z.enum(['確認済み', '有力候補', '未特定']),
  rightsStatus: z.enum(['利用許諾確認済み', '公開ライセンス', '公式投稿へのリンクのみ', '権利条件不明']),
  note: z.string().min(30).max(500),
}).strict();

const mediaTrendSchema = z.object({
  formats: z.array(z.enum(['ミーム', '短尺動画', '長尺動画', '音源・楽曲', 'ダンス・チャレンジ', '画像・テンプレート', '言い回し', 'その他'])).min(1).max(4),
  origin: z.object({
    status: z.enum(['確認済み', '有力候補', '未特定', '起源に異説あり']),
    platform: z.string().min(1).max(80),
    creatorName: z.string().min(1).max(160).nullable(),
    accountHandle: z.string().min(1).max(160).nullable(),
    originalUrl: z.url().nullable(),
    postedAt: isoDateTime.nullable(),
    explanation: z.string().min(80).max(900),
  }).strict(),
  sourceMaterialAnalysis: z.string().min(80).max(900),
  sourceMaterials: z.array(trendMaterialSchema).max(8),
  musicAnalysis: z.string().min(60).max(700),
  music: z.array(trendMaterialSchema).max(5),
  spread: z.array(z.object({
    platform: z.string().min(1).max(80),
    observedAt: isoDateTime,
    evidence: z.string().min(40).max(600),
    exampleUrl: z.url().nullable(),
  }).strict()).min(1).max(8),
  reactionSummary: z.string().min(100).max(1000),
  neutralAssessment: z.string().min(100).max(1000),
  rightsAndSafety: z.string().min(100).max(1000),
}).strict().superRefine((trend, ctx) => {
  if (trend.origin.status === '確認済み' && (!trend.origin.creatorName || !trend.origin.originalUrl || !trend.origin.postedAt)) {
    ctx.addIssue({ code: 'custom', path: ['origin'], message: '起源を確認済みとする場合は投稿者、元URL、投稿日時が必要です' });
  }
  for (const [index, material] of trend.sourceMaterials.entries()) {
    if (material.identificationStatus === '確認済み' && !material.sourceUrl) {
      ctx.addIssue({ code: 'custom', path: ['sourceMaterials', index, 'sourceUrl'], message: '素材を確認済みとする場合は根拠URLが必要です' });
    }
  }
  for (const [index, material] of trend.music.entries()) {
    if (material.identificationStatus === '確認済み' && !material.sourceUrl) {
      ctx.addIssue({ code: 'custom', path: ['music', index, 'sourceUrl'], message: '音源を確認済みとする場合は根拠URLが必要です' });
    }
  }
});

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
  articleDetail: articleDetailSchema.optional(),
  mediaTrend: mediaTrendSchema.optional(),
  attentionAnalysis: z.object({
    whyNotable: z.string().min(20).max(240),
    currentReaction: z.string().min(20).max(240),
    assessment: z.enum(['過熱気味', '妥当', '注目不足', '評価が分かれる', '判断には早い']),
    assessmentComment: z.string().min(20).max(240),
  }).strict(),
  informationType: z.enum(['公式発表', '報道', '研究', '意見', 'ミーム・ネット文化']),
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
    policyVersion: z.union([z.literal(1), z.literal(2)]),
    summariesAreOriginal: z.literal(true),
    copiedBody: z.literal(false),
    copiedImages: z.literal(false),
    quotationsReviewed: z.literal(true),
    sourceTermsReviewed: z.literal(true),
    explanationsReviewed: z.literal(true),
  }).strict(),
  articles: z.array(articleSchema).min(1),
}).strict().superRefine((edition, ctx) => {
  if (edition.date >= '2026-10-26' && edition.contentCompliance.policyVersion !== 2) {
    ctx.addIssue({ code: 'custom', path: ['contentCompliance', 'policyVersion'], message: '2026-10-26以降は内容充実方針v2が必要です' });
  }
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
    if (edition.contentCompliance.policyVersion === 2) {
      if (article.summary.length !== 3 || article.summary.join('').length < 240) {
        ctx.addIssue({ code: 'custom', path: ['articles', index, 'summary'], message: '方針v2の概要は結論・事実・範囲の3段落、合計240文字以上が必要です' });
      }
      if (article.comment.length < 300) {
        ctx.addIssue({ code: 'custom', path: ['articles', index, 'comment'], message: '方針v2の解説は300文字以上必要です' });
      }
      if (!article.articleDetail) {
        ctx.addIssue({ code: 'custom', path: ['articles', index, 'articleDetail'], message: '方針v2では構造化した詳しい解説が必要です' });
      }
      const prose = [
        ...article.summary,
        article.comment,
        ...(article.articleDetail ? [
          article.articleDetail.conclusion,
          ...article.articleDetail.facts,
          ...article.articleDetail.background,
          ...article.articleDetail.explanation,
          ...article.articleDetail.implications,
          ...article.articleDetail.caveats,
          ...article.articleDetail.nextChecks,
        ] : []),
      ].join(' ');
      for (const boilerplate of forbiddenEditorialBoilerplate) {
        if (prose.includes(boilerplate)) ctx.addIssue({ code: 'custom', path: ['articles', index], message: `定型的な埋め草を使用できません: ${boilerplate}` });
      }
    }
    const isMediaTrend = article.informationType === 'ミーム・ネット文化' || article.categories.includes('ネット文化・ミーム');
    if (isMediaTrend && !article.mediaTrend) {
      ctx.addIssue({ code: 'custom', path: ['articles', index, 'mediaTrend'], message: 'ミーム・流行動画には発祥・素材・拡散・反響・権利の検証記録が必要です' });
    }
    if (!isMediaTrend && article.mediaTrend) {
      ctx.addIssue({ code: 'custom', path: ['articles', index, 'mediaTrend'], message: 'mediaTrendを使う記事は情報種別またはカテゴリをネット文化・ミームにしてください' });
    }
  }
  if ([1, 2, 3, 4, 5].some((rank) => !ranks.has(rank))) ctx.addIssue({ code: 'custom', path: ['articles'], message: 'Top 5の順位1〜5が必要です' });
});

const forbiddenEditorialBoilerplate = [
  '原文の更新、反対意見、対象範囲を継続して確認し',
  '確認済みの事実と発表者の評価を分け、実生活や業務への影響',
  '単一の数値や印象だけで結論を固定しないことが重要',
];

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
