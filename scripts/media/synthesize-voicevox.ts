import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { readVoicevoxConfig } from './config';
import { getDateArgument, readEdition } from './edition';
import { buildNarrationPlan } from './narration';
import { applyPronunciations, readPronunciations } from './pronunciation';

type VoicevoxSpeaker = {
  name: string;
  styles: Array<{ name: string; id: number; type?: string }>;
};

const endpoint = (process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021').replace(/\/$/, '');
const edition = await readEdition(getDateArgument());
const config = await readVoicevoxConfig();
const plan = buildNarrationPlan(edition, config.cast, config.credit);
const pronunciations = await readPronunciations();
const outputDirectory = resolve('generated/media', edition.date, 'voice');
await mkdir(outputDirectory, { recursive: true });

const speakers = await getJson<VoicevoxSpeaker[]>('/speakers');
const styleIds = new Map<string, number>();
for (const member of config.cast) {
  const speaker = speakers.find((candidate) => candidate.name === member.name);
  const style = speaker?.styles.find((candidate) =>
    candidate.name === member.style && (!candidate.type || candidate.type.endsWith('talk')),
  );
  if (!speaker || !style) {
    throw new Error(`VOICEVOXに「${member.name} / ${member.style}」が見つかりません`);
  }
  styleIds.set(`${member.name}/${member.style}`, style.id);
}

const files: string[] = [];
const timeline: Array<{ id: string; title: string; speaker: string; start: number; end: number }> = [];
let elapsed = 0;
for (const [index, segment] of plan.segments.entries()) {
  const styleId = styleIds.get(`${segment.speaker.name}/${segment.speaker.style}`)!;
  const query = await postJson<Record<string, unknown>>('/audio_query', {
    text: applyPronunciations(segment.text, pronunciations),
    speaker: String(styleId),
  });
  query.speedScale = segment.speaker.speedScale;
  query.volumeScale = segment.speaker.volumeScale ?? 1;
  query.outputSamplingRate = config.outputSamplingRate;
  query.outputStereo = config.outputStereo;
  query.prePhonemeLength = index === 0 ? config.pause.opening : 0.3;
  query.postPhonemeLength = index === plan.segments.length - 1 ? config.pause.closing : config.pause.betweenSegments;

  const audio = await postBinary('/synthesis', { speaker: String(styleId) }, query);
  const filename = `${String(index + 1).padStart(2, '0')}-${segment.id}.wav`;
  await writeFile(resolve(outputDirectory, filename), audio);
  files.push(filename);
  const duration = await probeDuration(resolve(outputDirectory, filename));
  timeline.push({ id: segment.id, title: segment.text, speaker: segment.speaker.name, start: elapsed, end: elapsed + duration });
  elapsed += duration;
  if (/^rank-[1-4]$/.test(segment.id)) {
    const jingle = `jingle-${segment.id}.wav`;
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
      `sine=frequency=880:duration=${config.pause.jingle}:sample_rate=${config.outputSamplingRate}`,
      '-af', 'afade=t=out:st=0.25:d=0.45,volume=0.12', '-ac', config.outputStereo ? '2' : '1', resolve(outputDirectory, jingle)]);
    files.push(jingle);
    elapsed += config.pause.jingle;
  }
  console.log(`${segment.speaker.name}: ${filename}`);
}

const concatFile = resolve(outputDirectory, 'concat.txt');
await writeFile(concatFile, files.map((file) => `file '${file}'`).join('\n') + '\n');
await run('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0',
  '-i', concatFile, '-c:a', 'pcm_s16le', resolve(outputDirectory, 'top5-voice.wav'),
]);
await writeFile(resolve(outputDirectory, 'credits.txt'), `${plan.credit}\n`);
await writeFile(resolve(outputDirectory, 'timeline.json'), `${JSON.stringify({ date: edition.date, credit: plan.credit, segments: timeline }, null, 2)}\n`);
console.log(`${resolve(outputDirectory, 'top5-voice.wav')} を生成しました。`);

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${endpoint}${path}`);
  if (!response.ok) throw new Error(`VOICEVOX ${path}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const response = await fetch(`${endpoint}${path}?${new URLSearchParams(params)}`, { method: 'POST' });
  if (!response.ok) throw new Error(`VOICEVOX ${path}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function postBinary(path: string, params: Record<string, string>, body: unknown) {
  const response = await fetch(`${endpoint}${path}?${new URLSearchParams(params)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`VOICEVOX ${path}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function run(command: string, args: string[]) {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`${command}: exit ${code}`)));
  });
}

async function probeDuration(path: string) {
  return new Promise<number>((resolvePromise, reject) => {
    let output = '';
    const child = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolvePromise(Number(output.trim())) : reject(new Error(`ffprobe: exit ${code}`)));
  });
}
