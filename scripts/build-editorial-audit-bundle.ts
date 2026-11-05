import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDateArgument, readEdition } from './media/edition';

const edition = await readEdition(getDateArgument());
const narrationPath = resolve('generated/media', edition.date, 'narration.json');
const narration = JSON.parse(await readFile(narrationPath, 'utf8'));
const top5 = edition.articles.filter((article) => article.top5Rank !== null);
const others = edition.articles.filter((article) => article.top5Rank === null);
const seed = Number(edition.date.replaceAll('-', ''));
const sampleIds = new Set(others
  .map((article, index) => ({ article, score: (index * 1103515245 + seed) >>> 0 }))
  .sort((a, b) => a.score - b.score).slice(0, 5).map(({ article }) => article.id));
const riskIds = new Set(others.filter((article) => article.followUp || article.lateInclusion
  || article.mediaTrend || article.categories.includes('VCF・VMware・競合')).map((article) => article.id));
const fullIds = new Set([...sampleIds, ...riskIds]);
const outline = (article: typeof edition.articles[number]) => ({
  id: article.id, title: article.title, sourceName: article.sourceName, sourceUrl: article.sourceUrl,
  publishedAt: article.publishedAt, categories: article.categories, top5Rank: article.top5Rank,
  summary: article.summary, conclusion: article.articleDetail?.conclusion ?? null,
  whyNotable: article.attentionAnalysis.whyNotable, followUp: article.followUp ?? null,
  lateInclusion: article.lateInclusion ?? null,
});
const fullArticle = (article: typeof edition.articles[number]) => ({
  ...outline(article),
  comment: article.comment,
  articleDetail: article.articleDetail ?? null,
  attentionAnalysis: article.attentionAnalysis,
  relatedArticleIds: article.relatedArticleIds,
});
const fullArticleIds = [...new Set([...top5.map((article) => article.id), ...fullIds])];
const bundle = {
  version: 1,
  date: edition.date,
  auditScope: {
    allArticleOutlines: edition.articles.length,
    fullArticleIds,
    deterministicSampleIds: [...sampleIds],
    riskArticleIds: [...riskIds],
  },
  selectionShortfallReason: edition.selectionShortfallReason ?? null,
  monitoringFindings: edition.monitoringReview?.findings ?? [],
  outlines: edition.articles.map(outline),
  fullArticles: edition.articles.filter((article) => article.top5Rank !== null || fullIds.has(article.id)).map(fullArticle),
  narration: {
    date: narration.date,
    title: narration.title,
    credit: narration.credit,
    segments: narration.segments.map((segment: { id: string; speaker: { name: string }; text: string }) => ({
      id: segment.id,
      speaker: segment.speaker.name,
      text: segment.text,
    })),
  },
};
const directory = resolve('generated/media', edition.date);
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'editorial-audit-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
console.log(JSON.stringify({ date: edition.date, outlines: bundle.outlines.length, fullArticles: bundle.fullArticles.length,
  sampleArticles: sampleIds.size, riskArticles: riskIds.size }));
