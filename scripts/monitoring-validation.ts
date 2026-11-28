import type { Edition } from '../src/lib/schema';
import { z } from 'zod';

export const monitoringRegistrySchema = z.object({
  version: z.number().int().positive(),
  enforcementStartDate: z.iso.date(),
  sources: z.array(z.object({
    id: z.string().min(1),
    area: z.enum(['general', 'ai', 'security', 'vcf']),
    requiredDaily: z.boolean(),
    requiredFrom: z.iso.date().optional(),
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
// Published editions before this rule was introduced remain read-only historical records.
const statusEvidenceEnforcementStartDate = '2026-11-10';
export const frameEnforcementStartDate = '2026-11-28';

export function summarizeFrames(edition: Edition): {
  generalCount: number;
  workCount: number;
  generalTechSecurityCount: number;
  generalTechSecurityRatio: number;
  top5WorkCount: number;
  legacy: boolean;
} {
  const legacy = edition.date < frameEnforcementStartDate;
  const isWork = (article: Edition['articles'][number]) => legacy
    ? article.categories.includes('VCF・VMware・競合')
    : article.frame === 'work';
  const general = edition.articles.filter((article) => !isWork(article));
  const work = edition.articles.filter(isWork);
  const generalTechSecurityCount = general.filter((article) =>
    article.categories.includes('テクノロジー') || article.categories.includes('セキュリティ')).length;
  return {
    generalCount: general.length,
    workCount: work.length,
    generalTechSecurityCount,
    generalTechSecurityRatio: general.length ? generalTechSecurityCount / general.length : 0,
    top5WorkCount: work.filter((article) => article.top5Rank !== null).length,
    legacy,
  };
}

export function validateMonitoringCoverage(edition: Edition, registry: MonitoringRegistry): string[] {
  if (edition.date < registry.enforcementStartDate) return [];

  const errors: string[] = [];
  const legacy = edition.date < frameEnforcementStartDate;
  if (!legacy) {
    for (const article of edition.articles) {
      if (!article.frame) errors.push(`${edition.date}: 記事 ${article.id} に frame がありません`);
      if (article.categories.includes('VCF・VMware・競合') && article.frame !== 'work') {
        errors.push(`${edition.date}: VCF・VMware・競合カテゴリの記事 ${article.id} は frame を work にしてください`);
      }
    }
  }
  const review = edition.monitoringReview;
  if (!review) return [...errors, `${edition.date}: monitoringReview がありません`];
  if (review.policyVersion !== registry.version) {
    errors.push(`${edition.date}: monitoringReview.policyVersion が監視設定と一致しません`);
  }

  const configured = new Map(registry.sources.map((source) => [source.id, source]));
  const seen = new Set<string>();
  const noteCounts = new Map<string, number>();
  const checkedAtCounts = new Map<string, number>();
  for (const entry of review.entries) {
    if (seen.has(entry.sourceId)) errors.push(`${edition.date}: 監視元 ${entry.sourceId} が重複しています`);
    seen.add(entry.sourceId);
    if (!configured.has(entry.sourceId)) errors.push(`${edition.date}: 未定義の監視元 ${entry.sourceId} があります`);
    if (entry.status !== 'checked' && entry.note.length < 30) {
      errors.push(`${edition.date}: ${entry.sourceId} の確認不能理由が不足しています`);
    }
    noteCounts.set(entry.note, (noteCounts.get(entry.note) ?? 0) + 1);
    checkedAtCounts.set(entry.checkedAt, (checkedAtCounts.get(entry.checkedAt) ?? 0) + 1);
  }
  for (const source of registry.sources.filter((source) => source.requiredDaily && (!source.requiredFrom || edition.date >= source.requiredFrom))) {
    if (!seen.has(source.id)) errors.push(`${edition.date}: 必須監視元 ${source.id} (${source.label}) の記録がありません`);
    const entry = review.entries.find((item) => item.sourceId === source.id);
    if (edition.date >= statusEvidenceEnforcementStartDate && entry && entry.status !== 'checked' && !review.findings.some((finding) => finding.sourceId === source.id)) {
      errors.push(`${edition.date}: 確認不能の必須監視元 ${source.id} には sourceId 付き finding が必要です`);
    }
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

  // 期日より前は公開済み版のカテゴリ基準をそのまま維持する。
  const general = legacy
    ? edition.articles.filter((article) => !article.categories.includes('VCF・VMware・競合'))
    : edition.articles.filter((article) => article.frame === 'general');
  const vcf = edition.articles.filter((article) => article.categories.includes('VCF・VMware・競合'));
  if (!general.length) errors.push(`${edition.date}: 一般ニュースがありません`);
  if (edition.date >= '2026-11-01' && general.length < 25 && !edition.selectionShortfallReason) {
    errors.push(`${edition.date}: 一般ニュースが25件未満の場合は、弱い記事で埋めず selectionShortfallReason に不足理由を記録してください`);
  }
  if (edition.date >= '2026-11-01') {
    for (const [note, count] of noteCounts) {
      if (count > 1) errors.push(`${edition.date}: 監視注記を${count}件で使い回しています: ${note}`);
    }
    for (const [checkedAt, count] of checkedAtCounts) {
      if (count > 3) errors.push(`${edition.date}: ${count}件の監視元が同一確認時刻 ${checkedAt} です。各監視元の実確認時刻を記録してください`);
    }
  }
  if (legacy && vcf.length > 5) errors.push(`${edition.date}: VCF専門枠は5件以下にしてください`);

  const technologyOrSecurity = general.filter((article) =>
    article.categories.includes('テクノロジー') || article.categories.includes('セキュリティ'));
  // 比率は選定バランスの目安。公開済みの2026-11-12以前だけは従来の40％（短縮版60％）上限を検証する。
  const technologySecurityLimit = general.length < 8 ? 0.6 : 0.4;
  if (edition.date <= '2026-11-12' && general.length && technologyOrSecurity.length / general.length > technologySecurityLimit) {
    errors.push(`${edition.date}: 一般ニュースのテクノロジー・セキュリティ比率が${technologySecurityLimit * 100}％を超えています`);
  }

  // Top 5 は一般枠と仕事枠をまたいで選ぶため、多様性は版全体で数える。
  const top5 = edition.articles.filter((article) => article.top5Rank !== null);
  const top5Sources = new Set(top5.map((article) => article.sourceName));
  const top5Categories = new Set(top5.flatMap((article) => article.categories));
  if (top5Sources.size < 4) errors.push(`${edition.date}: Top 5は4媒体以上が必要です`);
  if (top5Categories.size < 4) errors.push(`${edition.date}: Top 5は4分野以上が必要です`);

  return errors;
}
