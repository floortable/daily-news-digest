import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { checkGenerationComplete } from '../scripts/check-generation-complete';

const date = '2026-11-14';

async function completeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'daily-news-complete-'));
  const articleId = `${date}-example`;
  await mkdir(join(root, `generated/candidates`), { recursive: true });
  await mkdir(join(root, `generated/articles/${date}/anchors`), { recursive: true });
  await mkdir(join(root, `generated/media/${date}`), { recursive: true });
  await writeFile(join(root, `generated/candidates/${date}.final.json`), JSON.stringify({ candidates: [{ decision: 'included', articleId }] }));
  await writeFile(join(root, `generated/articles/${date}/${articleId}.json`), '{}');
  await writeFile(join(root, `generated/articles/${date}/anchors/${articleId}.json`), '{}');
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
});
