/** 個別記事、確定台帳、版メタから日次版を決定的に組み立てる。 */
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { articleSchema, editionSchema } from '../src/lib/schema';
import { monitoringRegistrySchema, validateMonitoringCoverage } from './monitoring-validation';
import { collectTitleBodyErrors } from './title-body-guard';

const finalLedgerSchema = z.object({
  version: z.number().int().positive(),
  date: z.iso.date(),
  candidates: z.array(z.object({
    decision: z.enum(['included', 'deferred', 'not-relevant']),
    articleId: z.string().regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/).optional(),
  }).passthrough()),
}).passthrough();

const metaSchema = z.object({
  generatedAt: z.iso.datetime({ offset: true }),
  selectionShortfallReason: z.string().optional(),
  contentCompliance: z.unknown(),
  monitoringReview: z.unknown(),
}).strict();

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}

function usage(): never { throw new Error('使い方: assemble-edition.ts --date YYYY-MM-DD [--check] [--ledger PATH] [--articles-dir PATH] [--out PATH]'); }

async function main(): Promise<void> {
  const date = valueAfter('--date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) usage();
  const checkOnly = process.argv.includes('--check');
  const ledgerPath = valueAfter('--ledger') ?? resolve(`generated/candidates/${date}.final.json`);
  const articlesDir = valueAfter('--articles-dir') ?? resolve(`generated/articles/${date}`);
  const outPath = valueAfter('--out') ?? resolve(`data/daily/${date}.json`);
  const ledger = finalLedgerSchema.parse(JSON.parse(await readFile(ledgerPath, 'utf8')));
  if (ledger.date !== date) throw new Error(`${ledgerPath}: 台帳の日付が ${date} と一致しません`);

  const order = new Map<string, number>();
  for (const [index, candidate] of ledger.candidates.entries()) {
    if (candidate.decision === 'included') {
      if (!candidate.articleId) throw new Error(`${ledgerPath}: included の候補 index ${index} に articleId がありません`);
      if (order.has(candidate.articleId)) throw new Error(`${ledgerPath}: articleId ${candidate.articleId} が重複しています`);
      order.set(candidate.articleId, index);
    } else if (candidate.articleId) {
      throw new Error(`${ledgerPath}: ${candidate.decision} の候補に articleId は設定できません`);
    }
  }
  if (!order.size) throw new Error(`${ledgerPath}: included の候補がありません`);

  // anchors は生成時の根拠メモであり、公開データ検証ではなく結合前に必須とする。
  for (const id of order.keys()) {
    const anchorPath = resolve(articlesDir, 'anchors', `${id}.json`);
    try {
      await access(anchorPath);
    } catch {
      throw new Error(`台帳で included の ${id} に対応するアンカー事実がありません: ${anchorPath}`);
    }
  }

  const rawMeta = JSON.parse(await readFile(resolve(articlesDir, 'edition-meta.json'), 'utf8'));
  const meta = metaSchema.parse(rawMeta);
  const names = (await readdir(articlesDir)).filter((name) => name.endsWith('.json') && name !== 'edition-meta.json');
  const byId = new Map<string, { parsed: z.infer<typeof articleSchema>; raw: unknown }>();
  for (const name of names) {
    const raw = JSON.parse(await readFile(resolve(articlesDir, name), 'utf8'));
    const article = articleSchema.parse(raw);
    if (`${article.id}.json` !== name) throw new Error(`${name}: ファイル名と記事ID ${article.id} が一致しません`);
    if (article.editionDate !== date) throw new Error(`${name}: editionDate が ${date} ではありません`);
    if (!order.has(article.id)) throw new Error(`${name}: 台帳で included ではない記事ファイルです`);
    if (byId.has(article.id)) throw new Error(`${name}: 記事ID ${article.id} が重複しています`);
    byId.set(article.id, { parsed: article, raw });
  }
  for (const id of order.keys()) if (!byId.has(id)) throw new Error(`台帳で included の ${id} に対応する記事ファイルがありません`);

  const entries = [...byId.values()];
  const top5 = entries.filter(({ parsed }) => parsed.top5Rank !== null).sort((a, b) => a.parsed.top5Rank! - b.parsed.top5Rank!);
  const ranks = top5.map(({ parsed }) => parsed.top5Rank!);
  if (ranks.length && (ranks.length !== 5 || new Set(ranks).size !== 5 || ranks.some((rank, index) => rank !== index + 1))) {
    throw new Error(`top5Rank は 1〜5 を重複なく全て持つ必要があります: ${ranks.join(', ')}`);
  }
  const rest = entries.filter(({ parsed }) => parsed.top5Rank === null).sort((a, b) => order.get(a.parsed.id)! - order.get(b.parsed.id)!);
  const assembled = {
    date,
    generatedAt: rawMeta.generatedAt,
    selectionShortfallReason: rawMeta.selectionShortfallReason,
    contentCompliance: rawMeta.contentCompliance,
    monitoringReview: rawMeta.monitoringReview,
    articles: [...top5, ...rest].map(({ raw }) => raw),
  };
  const edition = editionSchema.parse(assembled);
  const titleErrors = collectTitleBodyErrors(edition);
  if (titleErrors.length) throw new Error(titleErrors.join('\n'));
  const registry = monitoringRegistrySchema.parse(JSON.parse(await readFile(resolve('config/monitoring-sources.json'), 'utf8')));
  const monitoringErrors = validateMonitoringCoverage(edition, registry);
  if (monitoringErrors.length) throw new Error(monitoringErrors.join('\n'));
  const serialized = `${JSON.stringify(assembled, null, 2)}\n`;
  if (checkOnly) {
    const existing = await readFile(outPath, 'utf8');
    if (existing !== serialized) throw new Error(`${date}: 既存の版JSONとバイト単位で一致しません`);
    console.log(`${date}: 既存の版JSONとバイト単位で一致しました（記事${entries.length}件）。`);
    return;
  }
  await writeFile(outPath, serialized);
  console.log(`${date}: 記事${entries.length}件（Top 5 ${top5.length}件＋他${rest.length}件）を ${outPath} へ結合しました。`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
