/** 監視元を再確認した実測時刻を edition-meta に記録する。 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

function jstTimestamp(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`;
}

const monitoringSchema = z.object({
  monitoringReview: z.object({ entries: z.array(z.object({ sourceId: z.string(), checkedAt: z.string() }).passthrough()) }).passthrough(),
}).passthrough();

export async function stampMonitoringCheck(metaPath: string, sourceIds: string[], all: boolean, now = new Date()): Promise<string[]> {
  const raw = JSON.parse(await readFile(metaPath, 'utf8'));
  const meta = monitoringSchema.parse(raw);
  const known = new Set(meta.monitoringReview.entries.map((entry) => entry.sourceId));
  for (const sourceId of sourceIds) if (!known.has(sourceId)) throw new Error(`${sourceId}: 存在しない監視元です`);
  const selected = all ? known : new Set(sourceIds);
  const timestamp = jstTimestamp(now);
  for (const entry of meta.monitoringReview.entries) if (selected.has(entry.sourceId)) entry.checkedAt = timestamp;
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  return [...selected];
}

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const date = valueAfter('--date');
  const sources = process.argv.flatMap((value, index) => value === '--source' ? [process.argv[index + 1]] : []).filter(Boolean);
  const all = process.argv.includes('--all');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (all === (sources.length > 0))) {
    throw new Error('使い方: stamp-monitoring-check.ts --date YYYY-MM-DD (--source sourceId [--source sourceId...] | --all)');
  }
  const updated = await stampMonitoringCheck(resolve(`generated/articles/${date}/edition-meta.json`), sources, all);
  console.log(`${date}: ${updated.join(', ')} の checkedAt を記録しました。`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
