import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { editionSchema, normalizeUrl } from '../src/lib/schema';

const directory = resolve('data/daily');
const files = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
if (!files.length) throw new Error('data/daily にJSONファイルがありません');

const globalIds = new Set<string>();
const globalUrls = new Map<string, { id: string; editionDate: string }>();
for (const file of files) {
  const parsed = editionSchema.parse(JSON.parse(await readFile(resolve(directory, file), 'utf8')));
  if (`${parsed.date}.json` !== file) throw new Error(`${file}: ファイル名と版の日付が一致しません`);
  for (const article of parsed.articles) {
    if (globalIds.has(article.id)) throw new Error(`${file}: 記事ID ${article.id} は別の日にも存在します`);
    globalIds.add(article.id);
    const url = normalizeUrl(article.sourceUrl);
    const previous = globalUrls.get(url);
    if (previous) {
      if (!article.relatedArticleIds.includes(previous.id)) throw new Error(`${file}: URLが ${previous.id} と重複しています`);
      if (!article.followUp || article.followUp.previousArticleId !== previous.id) {
        throw new Error(`${file}: ${article.id} は同じURLの再掲に具体的な更新記録がありません`);
      }
      if (article.followUp.originalEditionDate !== previous.editionDate) {
        throw new Error(`${file}: ${article.id} の再掲元日付が実際の掲載日と一致しません`);
      }
    }
    globalUrls.set(url, { id: article.id, editionDate: article.editionDate });
  }
}
console.log(`${files.length}日分、${globalIds.size}記事のデータ検証に成功しました。`);
