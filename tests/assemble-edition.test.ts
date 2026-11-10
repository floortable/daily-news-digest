import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const date = '2026-11-10';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'daily-news-assemble-'));
  const edition = JSON.parse(await readFile(`data/daily/${date}.json`, 'utf8'));
  const articlesDir = join(root, 'articles');
  const ledgerPath = join(root, 'ledger.json');
  const outPath = join(root, 'edition.json');
  await writeFile(ledgerPath, JSON.stringify({
    version: 1,
    date,
    candidates: edition.articles.map((article: { id: string }) => ({ decision: 'included', articleId: article.id })),
  }));
  await mkdir(articlesDir);
  await writeFile(join(articlesDir, 'edition-meta.json'), JSON.stringify({
    generatedAt: edition.generatedAt,
    selectionShortfallReason: edition.selectionShortfallReason,
    contentCompliance: edition.contentCompliance,
    monitoringReview: edition.monitoringReview,
  }));
  await Promise.all(edition.articles.map((article: { id: string }) =>
    writeFile(join(articlesDir, `${article.id}.json`), JSON.stringify(article))));
  return { root, articlesDir, ledgerPath, outPath, ids: edition.articles.map((article: { id: string }) => article.id) };
}

function assemble(args: { articlesDir: string; ledgerPath: string; outPath: string }) {
  return spawnSync('npx', ['tsx', 'scripts/assemble-edition.ts', '--date', date, '--articles-dir', args.articlesDir, '--ledger', args.ledgerPath, '--out', args.outPath], {
    encoding: 'utf8',
  });
}

describe('edition:assemble の生成成果物ゲート', () => {
  it('全採用記事のアンカーと monitoringReview がそろうまで結合しない', async () => {
    const test = await fixture();
    try {
      let result = assemble(test);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('アンカー事実がありません');

      const anchors = join(test.articlesDir, 'anchors');
      await mkdir(anchors);
      await Promise.all(test.ids.map((id: string) => writeFile(join(anchors, `${id}.json`), '{}')));
      result = assemble(test);
      expect(result.status).toBe(0);

      const metaPath = join(test.articlesDir, 'edition-meta.json');
      const meta = JSON.parse(await readFile(metaPath, 'utf8'));
      delete meta.monitoringReview;
      await writeFile(metaPath, JSON.stringify(meta));
      result = assemble(test);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('monitoringReview');
    } finally {
      await rm(test.root, { recursive: true, force: true });
    }
  }, 15_000);
});
