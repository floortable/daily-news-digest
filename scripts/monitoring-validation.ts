import type { Edition } from '../src/lib/schema';
import { z } from 'zod';

export const monitoringRegistrySchema = z.object({
  version: z.number().int().positive(),
  enforcementStartDate: z.iso.date(),
  sources: z.array(z.object({
    id: z.string().min(1),
    area: z.enum(['general', 'ai', 'security', 'vcf']),
    requiredDaily: z.boolean(),
    label: z.string().min(1),
    urls: z.array(z.url()).min(1),
  })).min(1),
}).superRefine((registry, ctx) => {
  const ids = new Set<string>();
  for (const [index, source] of registry.sources.entries()) {
    if (ids.has(source.id)) {
      ctx.addIssue({ code: 'custom', path: ['sources', index, 'id'], message: '監視元IDが重複しています' });
    }
    ids.add(source.id);
  }
});

export type MonitoringRegistry = z.infer<typeof monitoringRegistrySchema>;

export function validateMonitoringCoverage(edition: Edition, registry: MonitoringRegistry): string[] {
  if (edition.date < registry.enforcementStartDate) return [];

  const errors: string[] = [];
  const review = edition.monitoringReview;
  if (!review) return [`${edition.date}: monitoringReview がありません`];
  if (review.policyVersion !== registry.version) {
    errors.push(`${edition.date}: monitoringReview.policyVersion が監視設定と一致しません`);
  }

  const configured = new Map(registry.sources.map((source) => [source.id, source]));
  const seen = new Set<string>();
  for (const entry of review.entries) {
    if (seen.has(entry.sourceId)) errors.push(`${edition.date}: 監視元 ${entry.sourceId} が重複しています`);
    seen.add(entry.sourceId);
    if (!configured.has(entry.sourceId)) errors.push(`${edition.date}: 未定義の監視元 ${entry.sourceId} があります`);
    if (entry.status !== 'checked' && entry.note.length < 30) {
      errors.push(`${edition.date}: ${entry.sourceId} の確認不能理由が不足しています`);
    }
  }
  for (const source of registry.sources.filter((source) => source.requiredDaily)) {
    if (!seen.has(source.id)) errors.push(`${edition.date}: 必須監視元 ${source.id} (${source.label}) の記録がありません`);
  }

  const articleIds = new Set(edition.articles.map((article) => article.id));
  for (const finding of review.findings) {
    if (!configured.has(finding.sourceId)) errors.push(`${edition.date}: finding の監視元 ${finding.sourceId} が未定義です`);
    if (finding.disposition === 'included') {
      if (!finding.articleId || !articleIds.has(finding.articleId)) {
        errors.push(`${edition.date}: 採用したfinding「${finding.title}」の記事IDが版内にありません`);
      }
    } else if (finding.articleId !== null) {
      errors.push(`${edition.date}: 非採用finding「${finding.title}」には記事IDを設定できません`);
    }
  }

  const general = edition.articles.filter((article) => !article.categories.includes('VCF・VMware・競合'));
  const vcf = edition.articles.filter((article) => article.categories.includes('VCF・VMware・競合'));
  if (!general.length) errors.push(`${edition.date}: 一般ニュースがありません`);
  if (vcf.length > 5) errors.push(`${edition.date}: VCF専門枠は5件以下にしてください`);

  const technologyOrSecurity = general.filter((article) =>
    article.categories.includes('テクノロジー') || article.categories.includes('セキュリティ'));
  if (general.length && technologyOrSecurity.length / general.length > 0.4) {
    errors.push(`${edition.date}: 一般ニュースのテクノロジー・セキュリティ比率が40％を超えています`);
  }

  const top5 = general.filter((article) => article.top5Rank !== null);
  const top5Sources = new Set(top5.map((article) => article.sourceName));
  const top5Categories = new Set(top5.flatMap((article) => article.categories));
  if (top5Sources.size < 4) errors.push(`${edition.date}: Top 5は4媒体以上が必要です`);
  if (top5Categories.size < 4) errors.push(`${edition.date}: Top 5は4分野以上が必要です`);

  return errors;
}
