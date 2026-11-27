import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { editionSchema } from '../src/lib/schema';
import { summarizeFrames } from './monitoring-validation';

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}

const date = valueAfter('--date');
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error('使い方: frame-stats.ts --date YYYY-MM-DD');
}
const edition = editionSchema.parse(JSON.parse(await readFile(resolve(`data/daily/${date}.json`), 'utf8')));
console.log(JSON.stringify(summarizeFrames(edition)));
