import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readVoicevoxConfig } from './config';
import { getDateArgument, readEdition } from './edition';
import { buildNarrationPlan } from './narration';
import { assertLatinPronunciations, readPronunciations } from './pronunciation';

const edition = await readEdition(getDateArgument());
const auditOnly = process.argv.includes('--audit-only');
const auditCast = [
  { name: '案内役A', style: 'audit', speedScale: 1 },
  { name: '案内役B', style: 'audit', speedScale: 1 },
  { name: '案内役C', style: 'audit', speedScale: 1 },
];
const config = auditOnly ? null : await readVoicevoxConfig();
const plan = buildNarrationPlan(
  edition,
  config?.cast ?? auditCast,
  config?.credit ?? '音声クレジットは監査後に確定します。',
  config?.spokenCredit ?? '',
);
if (!auditOnly) {
  const pronunciations = await readPronunciations();
  assertLatinPronunciations(plan.segments.map((segment) => segment.text), pronunciations);
}
const outputDirectory = resolve('generated/media', edition.date);
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, 'narration.json'), `${JSON.stringify(plan, null, 2)}\n`);
await writeFile(
  resolve(outputDirectory, 'narration.txt'),
  `${plan.title}\n\n${plan.segments.map((segment) => `${segment.speaker.name}: ${segment.text}`).join('\n\n')}\n\n${plan.credit}\n`,
);
console.log(`${outputDirectory} にTop 5読み上げ台本を生成しました。`);
