import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

const configSchema = z.object({
  cast: z.array(z.object({
    name: z.string().min(1),
    style: z.string().min(1),
    speedScale: z.number().min(0.5).max(2),
    volumeScale: z.number().min(0).max(2).default(1),
  })).length(3),
  outputSamplingRate: z.number().int().min(8000).max(96000),
  outputStereo: z.boolean(),
  pause: z.object({
    opening: z.number().min(0).max(3),
    betweenSegments: z.number().min(0).max(3),
    closing: z.number().min(0).max(5),
    jingle: z.number().min(0.2).max(3),
  }),
  bgmReductionDb: z.number().min(18).max(24),
  credit: z.string().min(1),
});

export async function readVoicevoxConfig() {
  const raw = JSON.parse(await readFile(resolve('config/voicevox.json'), 'utf8'));
  return configSchema.parse(raw);
}
