import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { checkGenerationComplete } from '../scripts/check-generation-complete';

const date = '2026-11-27';

async function completeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'daily-news-complete-'));
  const sourceEdition = JSON.parse(await readFile('data/daily/2026-11-14.json', 'utf8'));
  const article = sourceEdition.articles[0];
  article.id = `${date}-example`;
  article.editionDate = date;
  const articleId = article.id;
  await mkdir(join(root, `generated/candidates`), { recursive: true });
  await mkdir(join(root, `generated/articles/${date}/anchors`), { recursive: true });
  await mkdir(join(root, `generated/media/${date}`), { recursive: true });
  await writeFile(join(root, `generated/candidates/${date}.final.json`), JSON.stringify({ candidates: [{ decision: 'included', articleId }] }));
  await writeFile(join(root, `generated/articles/${date}/${articleId}.json`), JSON.stringify(article));
  await writeFile(join(root, `generated/articles/${date}/anchors/${articleId}.json`), JSON.stringify({
    sourceUrl: article.sourceUrl,
    facts: ['CryptoBilisで2026年8月から9月に購入されたSafe 5が調査対象とされた。', 'メーカーは取得機能を止める更新を11月11日に公開した。'],
    mechanism: '端末が取得した情報を暗号化し、携帯通信網経由で攻撃者側のサーバーへ送る設計だった。',
    impact: '対象購入者は購入記録を照合し、新しいシードのウォレットへ資金を移す案内の対象になる。',
    unknowns: '他販売店やモデルに追加の確認例があるか、支援対象の最終範囲は今後の発表で確定する。',
  }));
  await writeFile(join(root, `generated/media/${date}/narration.json`), '{}');
  await writeFile(join(root, `generated/media/${date}/editorial-audit-bundle.json`), '{}');
  return { root, articleId };
}

describe('edition:complete-check', () => {
  it('完了した生成物を受理する', async () => {
    const test = await completeFixture();
    try {
      const result = await checkGenerationComplete(date, { root: test.root, assembleCheck: () => ({ ok: true }) });
      expect(result).toEqual({ date, complete: true, missing: [] });
    } finally { await rm(test.root, { recursive: true, force: true }); }
  });

  it('記事とバンドルの欠落を報告する', async () => {
    const test = await completeFixture();
    try {
      await rm(join(test.root, `generated/articles/${date}/${test.articleId}.json`));
      await rm(join(test.root, `generated/media/${date}/editorial-audit-bundle.json`));
      const result = await checkGenerationComplete(date, { root: test.root, assembleCheck: () => ({ ok: true }) });
      expect(result.complete).toBe(false);
      expect(result.missing.map((item) => item.kind)).toEqual(expect.arrayContaining(['article', 'editorial-audit-bundle']));
    } finally { await rm(test.root, { recursive: true, force: true }); }
  });

  it('不良な記事とアンカー内容を記事ID付きで報告する', async () => {
    const test = await completeFixture();
    try {
      const articlePath = join(test.root, `generated/articles/${date}/${test.articleId}.json`);
      const article = JSON.parse(await readFile(articlePath, 'utf8'));
      article.articleDetail.facts = [article.title];
      article.articleDetail.implications = [];
      article.articleDetail.nextChecks = [];
      await writeFile(articlePath, JSON.stringify(article));
      await writeFile(join(test.root, `generated/articles/${date}/anchors/${test.articleId}.json`), '{}');

      const result = await checkGenerationComplete(date, { root: test.root, assembleCheck: () => ({ ok: true }) });
      expect(result.missing).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'article-gate', detail: expect.stringContaining(test.articleId) }),
        expect.objectContaining({ kind: 'anchor-content', detail: expect.stringContaining(test.articleId) }),
      ]));
    } finally { await rm(test.root, { recursive: true, force: true }); }
  });
});
