import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

const configSchema = z.object({
  cast: z.array(z.object({
    name: z.string().min(1),
    style: z.string().min(1),
    speedScale: z.number().min(0.5).max(2),
  })).length(3),
  outputSamplingRate: z.number().int().min(8000).max(96000),
  outputStereo: z.boolean(),
  credit: z.string().min(1),
});

export async function readVoicevoxConfig() {
  const raw = JSON.parse(await readFile(resolve('config/voicevox.json'), 'utf8'));
  return configSchema.parse(raw);
}
