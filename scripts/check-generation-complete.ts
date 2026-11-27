/** 日次生成の完了条件を機械的に確認する。 */
import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { z } from 'zod';
import { articleSchema } from '../src/lib/schema';
import { collectAnchorContentErrors } from '../src/lib/anchor-validation';
import { collectSingleArticleGateErrors } from './title-body-guard';

export type Missing = { kind: string; detail: string };
export type CompleteResult = { date: string; complete: boolean; missing: Missing[] };

const ledgerSchema = z.object({
  candidates: z.array(z.object({ decision: z.string(), articleId: z.string().nullish() }).passthrough()),
}).passthrough();

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

export function runAssembleCheck(date: string, root = process.cwd()): { ok: boolean; detail?: string } {
  const result = spawnSync('npx', ['tsx', resolve(root, 'scripts/assemble-edition.ts'), '--date', date, '--check'], {
    cwd: root, encoding: 'utf8',
  });
  return result.status === 0 ? { ok: true } : { ok: false, detail: `${result.stderr || result.stdout}`.trim() };
}

export async function checkGenerationComplete(
  date: string,
  options: { root?: string; assembleCheck?: (date: string, root: string) => { ok: boolean; detail?: string } } = {},
): Promise<CompleteResult> {
  const root = options.root ?? process.cwd();
  const missing: Missing[] = [];
  const ledgerPath = resolve(root, `generated/candidates/${date}.final.json`);
  let articleIds: string[] = [];
  try {
    const ledger = ledgerSchema.parse(JSON.parse(await readFile(ledgerPath, 'utf8')));
    for (const [index, candidate] of ledger.candidates.entries()) {
      if (candidate.decision === 'included') {
        if (!candidate.articleId) missing.push({ kind: 'ledger-article-id', detail: `included candidate ${index} has no articleId` });
        else articleIds.push(candidate.articleId);
      }
    }
  } catch {
    missing.push({ kind: 'final-ledger', detail: ledgerPath });
  }
  for (const articleId of articleIds) {
    const articlePath = resolve(root, `generated/articles/${date}/${articleId}.json`);
    const anchorPath = resolve(root, `generated/articles/${date}/anchors/${articleId}.json`);
    let article: z.infer<typeof articleSchema> | undefined;
    if (!await exists(articlePath)) {
      missing.push({ kind: 'article', detail: articlePath });
    } else {
      try {
        const parsed = articleSchema.safeParse(JSON.parse(await readFile(articlePath, 'utf8')));
        if (!parsed.success) {
          missing.push({ kind: 'article-gate', detail: `${articleId}: 記事形式が不正です: ${parsed.error.issues[0].message}` });
        } else {
          article = parsed.data;
          const errors = collectSingleArticleGateErrors(article, date);
          if (errors.length) missing.push({ kind: 'article-gate', detail: `${articleId}: ${errors.join(' / ')}` });
        }
      } catch {
        missing.push({ kind: 'article-gate', detail: `${articleId}: 記事JSONを読み取れません` });
      }
    }
    if (!await exists(anchorPath)) {
      missing.push({ kind: 'anchor', detail: anchorPath });
    } else if (article) {
      try {
        const errors = collectAnchorContentErrors(JSON.parse(await readFile(anchorPath, 'utf8')), article, date);
        if (errors.length) missing.push({ kind: 'anchor-content', detail: `${articleId}: ${errors.join(' / ')}` });
      } catch {
        missing.push({ kind: 'anchor-content', detail: `${articleId}: アンカーJSONを読み取れません` });
      }
    }
  }
  const assembled = (options.assembleCheck ?? runAssembleCheck)(date, root);
  if (!assembled.ok) missing.push({ kind: 'assemble-check', detail: assembled.detail || `${date}: assemble --check failed` });
  for (const name of ['narration.json', 'editorial-audit-bundle.json']) {
    const path = resolve(root, `generated/media/${date}/${name}`);
    if (!await exists(path)) missing.push({ kind: name === 'narration.json' ? 'narration' : 'editorial-audit-bundle', detail: path });
  }
  return { date, complete: missing.length === 0, missing };
}

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const date = valueAfter('--date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('使い方: check-generation-complete.ts --date YYYY-MM-DD');
  const result = await checkGenerationComplete(date);
  console.log(JSON.stringify(result));
  process.exitCode = result.complete ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
