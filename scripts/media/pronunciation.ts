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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
