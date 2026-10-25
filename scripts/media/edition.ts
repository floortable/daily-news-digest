import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { editionSchema } from '../../src/lib/schema';

export async function readEdition(requestedDate?: string) {
  const directory = resolve('data/daily');
  const date = requestedDate ?? (await readdir(directory))
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()
    .at(-1)
    ?.replace('.json', '');
  if (!date) throw new Error('日次ニュースがありません');
  return editionSchema.parse(JSON.parse(await readFile(resolve(directory, `${date}.json`), 'utf8')));
}

export function getDateArgument() {
  const index = process.argv.indexOf('--date');
  return index >= 0 ? process.argv[index + 1] : undefined;
}
