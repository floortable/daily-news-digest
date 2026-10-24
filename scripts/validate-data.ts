import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { editionSchema, normalizeUrl } from '../src/lib/schema';

const directory = resolve('private-data/daily');
const files = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
if (!files.length) throw new Error('private-data/daily にJSONファイルがありません');

const globalIds = new Set<string>();
const globalUrls = new Map<string, string>();
for (const file of files) {
  const parsed = editionSchema.parse(JSON.parse(await readFile(resolve(directory, file), 'utf8')));
  if (`${parsed.date}.json` !== file) throw new Error(`${file}: ファイル名と版の日付が一致しません`);
  for (const article of parsed.articles) {
    if (globalIds.has(article.id)) throw new Error(`${file}: 記事ID ${article.id} は別の日にも存在します`);
    globalIds.add(article.id);
    const url = normalizeUrl(article.sourceUrl);
    const previous = globalUrls.get(url);
    if (previous && !article.relatedArticleIds.includes(previous)) throw new Error(`${file}: URLが ${previous} と重複しています`);
    globalUrls.set(url, article.id);
  }
}
console.log(`${files.length}日分、${globalIds.size}記事のデータ検証に成功しました。`);
