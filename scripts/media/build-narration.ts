import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readVoicevoxConfig } from './config';
import { getDateArgument, readEdition } from './edition';
import { buildNarrationPlan } from './narration';
import { assertLatinPronunciations, readPronunciations } from './pronunciation';

const edition = await readEdition(getDateArgument());
const config = await readVoicevoxConfig();
const plan = buildNarrationPlan(edition, config.cast, config.credit, config.spokenCredit);
const pronunciations = await readPronunciations();
assertLatinPronunciations(plan.segments.map((segment) => segment.text), pronunciations);
const outputDirectory = resolve('generated/media', edition.date);
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, 'narration.json'), `${JSON.stringify(plan, null, 2)}\n`);
await writeFile(
  resolve(outputDirectory, 'narration.txt'),
  `${plan.title}\n\n${plan.segments.map((segment) => `${segment.speaker.name}: ${segment.text}`).join('\n\n')}\n\n${plan.credit}\n`,
);
console.log(`${outputDirectory} にTop 5読み上げ台本を生成しました。`);
