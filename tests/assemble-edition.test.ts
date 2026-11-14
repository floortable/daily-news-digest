import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { stampMonitoringCheck } from '../scripts/stamp-monitoring-check';

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

function assemble(args: { articlesDir: string; ledgerPath: string; outPath: string }, check = false) {
  return spawnSync('npx', ['tsx', 'scripts/assemble-edition.ts', '--date', date, '--articles-dir', args.articlesDir, '--ledger', args.ledgerPath, '--out', args.outPath, ...(check ? ['--check'] : [])], {
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

      const assembled = JSON.parse(await readFile(test.outPath, 'utf8'));
      expect(assembled.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
      expect(assembled.monitoringReview.checkedAt).toBe(assembled.generatedAt);

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

  it('自動スタンプだけが異なる版を --check で許可し、それ以外の差分は拒否する', async () => {
    const test = await fixture();
    try {
      const anchors = join(test.articlesDir, 'anchors');
      await mkdir(anchors);
      await Promise.all(test.ids.map((id: string) => writeFile(join(anchors, `${id}.json`), '{}')));

      expect(assemble(test).status).toBe(0);
      const checked = assemble(test, true);
      expect(checked.status).toBe(0);

      const assembled = JSON.parse(await readFile(test.outPath, 'utf8'));
      assembled.articles[0].title = `${assembled.articles[0].title} changed`;
      await writeFile(test.outPath, `${JSON.stringify(assembled, null, 2)}\n`);
      const rejected = assemble(test, true);
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toContain('バイト単位で一致しません');
    } finally {
      await rm(test.root, { recursive: true, force: true });
    }
  }, 15_000);

  it('未来の監視確認時刻を拒否し、スタンプは指定した監視元だけを更新する', async () => {
    const test = await fixture();
    try {
      const anchors = join(test.articlesDir, 'anchors');
      await mkdir(anchors);
      await Promise.all(test.ids.map((id: string) => writeFile(join(anchors, `${id}.json`), '{}')));
      const metaPath = join(test.articlesDir, 'edition-meta.json');
      const meta = JSON.parse(await readFile(metaPath, 'utf8'));
      const first = meta.monitoringReview.entries[0];
      const second = meta.monitoringReview.entries[1];
      first.checkedAt = '2999-01-01T00:00:00+09:00';
      await writeFile(metaPath, JSON.stringify(meta));
      const rejected = assemble(test);
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toContain(first.sourceId);

      first.checkedAt = '2026-11-10T00:00:00+09:00';
      await writeFile(metaPath, JSON.stringify(meta));
      await stampMonitoringCheck(metaPath, [first.sourceId], false, new Date('2026-11-10T01:02:03Z'));
      const stamped = JSON.parse(await readFile(metaPath, 'utf8'));
      expect(stamped.monitoringReview.entries[0].checkedAt).toBe('2026-11-10T10:02:03+09:00');
      expect(stamped.monitoringReview.entries[1].checkedAt).toBe(second.checkedAt);
    } finally {
      await rm(test.root, { recursive: true, force: true });
    }
  }, 15_000);
});
