import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

const dictionarySchema = z.record(z.string().min(1), z.string().min(1));

export async function readPronunciations() {
  return dictionarySchema.parse(JSON.parse(await readFile(resolve('config/pronunciations.json'), 'utf8')));
}

export function applyPronunciations(text: string, dictionary: Record<string, string>) {
  const keys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
  if (!keys.length) return text;
  const pattern = new RegExp(keys.map(escapeRegExp).join('|'), 'g');
  return text.replace(pattern, (surface) => dictionary[surface]);
}

export function findUnpronouncedLatinTerms(text: string, dictionary: Record<string, string>) {
  const spokenText = applyPronunciations(text, dictionary);
  return [...new Set(spokenText.match(/[A-Za-z][A-Za-z0-9]*(?:[.+#/_-][A-Za-z0-9]+)*/g) ?? [])];
}

export function assertLatinPronunciations(texts: string[], dictionary: Record<string, string>) {
  const terms = [...new Set(texts.flatMap((text) => findUnpronouncedLatinTerms(text, dictionary)))];
  if (terms.length) {
    throw new Error(
      `英語の製品名・ライブラリ名などに確認済みの読みがありません: ${terms.join(', ')}。`
      + '公式サイト、公式の日本語表記、開発元の発音案内などで読みを確認し、config/pronunciations.jsonへ追加してください。',
    );
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
