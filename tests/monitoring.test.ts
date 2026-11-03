import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { editionSchema, type Edition } from '../src/lib/schema';
import {
  monitoringRegistrySchema,
  validateMonitoringCoverage,
  type MonitoringRegistry,
} from '../scripts/monitoring-validation';

const registry = monitoringRegistrySchema.parse(JSON.parse(
  readFileSync(resolve('config/monitoring-sources.json'), 'utf8'),
));

function futureEdition(date = registry.enforcementStartDate): Edition {
  const raw = JSON.parse(readFileSync(resolve('data/daily/2026-10-29.json'), 'utf8'));
  raw.date = date;
  raw.generatedAt = `${date}T08:00:00+09:00`;
  for (const [index, article] of raw.articles.entries()) {
    article.id = `${date}-${String(index + 1).padStart(2, '0')}`;
    article.editionDate = date;
    article.relatedArticleIds = [];
    delete article.followUp;
    if (date >= '2026-11-01') {
      article.summary[2] += ` 検証用記事${index + 1}では、主体、対象、変更内容、数量、比較対象、適用範囲を一次資料に基づいて記録し、概要だけで中心事象を説明できる状態にする。`;
      article.comment += ` 検証用記事${index + 1}の独自解説では、通常の仕組み、今回変わった処理、利用者へ届く影響、従来方式との差、数値の意味、結論が変わる境界を一続きの因果として説明する。記事固有の入力と結果を示し、概要、注目理由、詳細欄に置いた文は再利用しない。監視予定や編集手順ではなく、読者が実装または判断へ使える具体的な理解を追加する。`;
    }
  }
  const top5Categories = ['国内・国際', '生活・文化', 'エンタメ', '科学・医療', 'その他'];
  for (const article of raw.articles.filter((item: { top5Rank: number | null }) => item.top5Rank !== null)) {
    article.categories = [top5Categories[article.top5Rank - 1]];
  }
  raw.monitoringReview = {
    policyVersion: registry.version,
    checkedAt: `${date}T07:30:00+09:00`,
    entries: registry.sources.filter((source) => source.requiredDaily).map((source, index) => ({
      sourceId: source.id,
      status: 'checked',
      checkedAt: `${date}T07:00:${String(index).padStart(2, '0')}+09:00`,
      note: `${source.label}を確認し、当日版の候補と重要な更新の有無を記録した。`,
      evidenceUrls: [source.urls[0]],
    })),
    findings: [],
  };
  return editionSchema.parse(raw);
}

function registryWithStart(enforcementStartDate: string): MonitoringRegistry {
  return { ...registry, enforcementStartDate };
}

describe('監視証跡の検証', () => {
  it('外部レビューを参考にしつつ独立監査を公開条件にしている', () => {
    const prompt = readFileSync(resolve('automation/daily-news-digest.prompt.md'), 'utf8');
    expect(prompt).toContain('reviews/README.md');
    expect(prompt).toContain('is:issue is:open in:title "[Museレビュー]"');
    expect(prompt).toContain('外部レビューやGitHubを取得できないことだけを理由に生成を停止せず');
    expect(prompt).toContain('指摘を鵜呑みにせず');
    expect(prompt).toContain('最新レビューや主担当の評価を渡さず');
    expect(prompt).toContain('独立監査');
    expect(prompt).toContain('レビューの文章、数値、評価をニュースの事実や記事材料として転記してはいけません');
    expect(prompt.indexOf('npm run media:script -- --date YYYY-MM-DD')).toBeLessThan(prompt.indexOf('記事と台本の独立監査が合格してから'));
    expect(prompt.indexOf('記事と台本の独立監査が合格してから')).toBeLessThan(prompt.indexOf('npm run media:voicevox -- --date YYYY-MM-DD'));
    expect(prompt.indexOf('npm run media:voicevox -- --date YYYY-MM-DD')).toBeLessThan(prompt.indexOf('commit、push、CI、Pages公開'));
    expect(prompt).toContain('fork_turns: "none"');
    expect(prompt).toContain('model: "gpt-5.6-sol"');
    expect(prompt).toContain('reasoning_effort: "medium"');
    expect(prompt).toContain('これらのためにサブエージェントを起動しません');
    expect(prompt).toContain('独立監査1体だけ');
    expect(prompt).toContain('新しい監査エージェントを繰り返し起動してはいけません');
    expect(prompt).toContain('6系へ自動昇格しません');
    expect(prompt).toContain('記事本文やログ全文をルートへ再掲させません');
  });

  it('施行日前の既存版には監視証跡を要求しない', () => {
    const edition = editionSchema.parse(JSON.parse(
      readFileSync(resolve('data/daily/2026-10-29.json'), 'utf8'),
    ));
    expect(validateMonitoringCoverage(edition, registry)).toEqual([]);
  });

  it('必須監視元をすべて記録した版を受理する', () => {
    expect(validateMonitoringCoverage(futureEdition(), registry)).toEqual([]);
  });

  it('必須監視元の欠落を検出する', () => {
    const edition = futureEdition();
    edition.monitoringReview!.entries.pop();
    expect(validateMonitoringCoverage(edition, registry).some((error) => error.includes('記録がありません'))).toBe(true);
  });

  it('アクセス不能理由の不足を検出する', () => {
    const edition = futureEdition();
    edition.monitoringReview!.entries[0].status = 'restricted';
    edition.monitoringReview!.entries[0].note = '取得不能';
    expect(validateMonitoringCoverage(edition, registry).some((error) => error.includes('確認不能理由'))).toBe(true);
  });

  it('監視注記と確認時刻の一括コピーを検出する', () => {
    const repeatedNotes = futureEdition('2026-11-01');
    for (const entry of repeatedNotes.monitoringReview!.entries) {
      entry.note = 'すべての監視元について新着、重大性、重複、一般枠との分離を確認しました。';
    }
    expect(validateMonitoringCoverage(repeatedNotes, registry).some((error) => error.includes('使い回して'))).toBe(true);

    const repeatedTimes = futureEdition('2026-11-01');
    for (const entry of repeatedTimes.monitoringReview!.entries) {
      entry.checkedAt = '2026-11-01T07:00:00+09:00';
    }
    expect(validateMonitoringCoverage(repeatedTimes, registry).some((error) => error.includes('同一確認時刻'))).toBe(true);
  });

  it('25件未満では具体的な不足理由を要求する', () => {
    const edition = futureEdition('2026-11-01');
    edition.articles = edition.articles.filter((article) =>
      article.top5Rank !== null || article.categories.includes('VCF・VMware・競合'));
    delete edition.selectionShortfallReason;
    expect(validateMonitoringCoverage(edition, registry).some((error) => error.includes('selectionShortfallReason'))).toBe(true);
  });

  it('一般ニュースの技術・セキュリティ偏重を検出する', () => {
    const edition = futureEdition();
    for (const article of edition.articles) article.categories = ['テクノロジー'];
    expect(validateMonitoringCoverage(edition, registry).some((error) => error.includes('40％'))).toBe(true);
  });

  it('施行日を過ぎたVCF記事に専用レビューを要求し、Top 5入りを拒否する', () => {
    const raw = futureEdition() as unknown as Record<string, any>;
    const vcf = structuredClone(raw.articles[5]);
    vcf.id = `${registry.enforcementStartDate}-vcf-01`;
    vcf.sourceUrl = 'https://example.com/vcf-advisory';
    vcf.categories = ['VCF・VMware・競合'];
    vcf.top5Rank = null;
    raw.articles.push(vcf);
    expect(() => editionSchema.parse(raw)).toThrow(/vcfReview/);

    vcf.vcfReview = {
      products: ['VMware Cloud Foundation'],
      versions: ['9.1.1'],
      affectedUsers: 'VMware Cloud Foundation 9.1.1を本番環境または検証環境で運用し、該当機能を利用する管理者と利用者。',
      operationalImpact: '更新や回避策の適用前に、影響するコンポーネント、サービス停止の要否、既存構成との互換性、ロールバック手順を公式情報で確認し、変更計画と監視項目へ反映する必要がある。',
      knownConstraints: ['現時点で公開されている公式文書の記載範囲のみを確定情報とし、未検証環境へ一般化しない。'],
      officialSources: ['https://example.com/vcf-advisory'],
      fieldSources: [],
      evidenceClassification: {
        officialFacts: ['公式アドバイザリ本文で対象製品、バージョン、影響範囲として明示されている事実。'],
        fieldReports: [],
        inference: [],
      },
      nextChecks: ['修正版の公開、関連Knowledge Baseの追記、回避策や既知制約の変更を継続して確認する。'],
    };
    expect(() => editionSchema.parse(raw)).not.toThrow();
    vcf.top5Rank = 5;
    expect(() => editionSchema.parse(raw)).toThrow(/Top 5/);
  });

  it('設定ファイルの監視元ID重複を拒否する', () => {
    const bad = structuredClone(registry);
    bad.sources.push(structuredClone(bad.sources[0]));
    expect(() => monitoringRegistrySchema.parse(bad)).toThrow(/重複/);
  });

  it('施行日設定を切り替えて検証境界を固定できる', () => {
    const edition = futureEdition();
    delete (edition as Partial<Edition>).monitoringReview;
    expect(validateMonitoringCoverage(edition, registryWithStart('2026-10-31'))).toEqual([]);
    expect(validateMonitoringCoverage(edition, registry).some((error) => error.includes('monitoringReview'))).toBe(true);
  });
});
