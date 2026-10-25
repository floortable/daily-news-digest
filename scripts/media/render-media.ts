import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Edition } from '../../src/lib/schema';
import { readVoicevoxConfig } from './config';
import { getDateArgument, readEdition } from './edition';

const timelineSchema = z.object({
  date: z.iso.date(), credit: z.string(),
  segments: z.array(z.object({ id: z.string(), title: z.string(), speaker: z.string(), start: z.number(), end: z.number() })),
});
const tracksSchema = z.array(z.object({ title: z.string(), file: z.string(), durationSeconds: z.number(), sha256: z.string() }));
const selectionSchema = z.object({
  rules: z.array(z.object({ name: z.string(), keywords: z.array(z.string()).min(1), tracks: z.array(z.string()).min(1) })),
  fallbackTracks: z.array(z.string()).min(1),
});

const edition = await readEdition(getDateArgument());
const config = await readVoicevoxConfig();
const root = resolve('generated/media', edition.date);
const voice = resolve(root, 'voice/top5-voice.wav');
const timeline = timelineSchema.parse(JSON.parse(await readFile(resolve(root, 'voice/timeline.json'), 'utf8')));
const tracks = tracksSchema.parse(JSON.parse(await readFile(resolve('assets/audio/bgm/tracks.json'), 'utf8')));
const selection = selectionSchema.parse(JSON.parse(await readFile(resolve('config/bgm-selection.json'), 'utf8')));
const duration = timeline.segments.at(-1)?.end ?? 1;
const articleWindows = [...timeline.segments.reduce((windows, segment) => {
  const match = segment.id.match(/^rank-([1-5])(?:-|$)/);
  if (!match) return windows;
  const rank = Number(match[1]);
  const current = windows.get(rank);
  windows.set(rank, current
    ? { start: Math.min(current.start, segment.start), end: Math.max(current.end, segment.end) }
    : { start: segment.start, end: segment.end });
  return windows;
}, new Map<number, { start: number; end: number }>()).entries()].sort(([a], [b]) => a - b);
if (articleWindows.length !== 5) throw new Error('BGM切替用の記事区間が5件ではありません');
const top5 = edition.articles.filter((article) => article.top5Rank !== null).sort((a, b) => a.top5Rank! - b.top5Rank!);
const selectedTracks = selectThemedTracks(top5, tracks, selection, edition.date);
const srt = resolve(root, 'top5.srt');
await writeFile(srt, timeline.segments.map((segment, index) =>
  `${index + 1}\n${stamp(segment.start)} --> ${stamp(segment.end)}\n${segment.speaker}：${subtitle(segment.title)}\n`,
).join('\n') + `\n${timeline.segments.length + 1}\n${stamp(Math.max(0, duration - 4))} --> ${stamp(duration)}\n${timeline.credit}\n`);

const noBgmWav = resolve(root, 'top5-no-bgm.wav');
await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', voice,
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', noBgmWav]);
await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', noBgmWav,
  '-c:a', 'aac', '-b:a', '160k', '-metadata', `comment=${timeline.credit}; BGMなし`, resolve(root, 'top5-no-bgm.m4a')]);

const mixedWav = resolve(root, 'top5-mixed.wav');
const bgmGain = 10 ** (-config.bgmReductionDb / 20);
const bgmInputs = selectedTracks.flatMap((track) => ['-stream_loop', '-1', '-i', resolve('assets/audio/bgm', track.file)]);
const voiceInputIndex = selectedTracks.length;
const bgmFilters = articleWindows.map(([, window], index) => {
  const start = index === 0 ? 0 : window.start;
  const end = index === articleWindows.length - 1 ? duration : window.end;
  const segmentDuration = end - start;
  const fadeDuration = Math.min(1.5, segmentDuration / 3);
  return `[${index}:a]volume=${bgmGain},atrim=0:${segmentDuration},asetpts=PTS-STARTPTS,afade=t=in:d=${fadeDuration},afade=t=out:st=${Math.max(0, segmentDuration - fadeDuration)}:d=${fadeDuration},adelay=${Math.round(start * 1000)}:all=1[bgm${index}]`;
});
const bgmMix = `${selectedTracks.map((_, index) => `[bgm${index}]`).join('')}amix=inputs=${selectedTracks.length}:duration=longest:normalize=0[bgm]`;
await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...bgmInputs,
  '-i', voice, '-filter_complex',
  `${bgmFilters.join(';')};${bgmMix};[${voiceInputIndex}:a][bgm]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]`,
  '-map', '[out]', '-ar', '48000', mixedWav]);
const bgmTitles = selectedTracks.map((track) => track.title).join(' / ');
await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', mixedWav,
  '-c:a', 'aac', '-b:a', '160k', '-metadata', `title=${timeline.date} 毎日の注目記事 Top 5`,
  '-metadata', `artist=floortable`,
  '-metadata', `comment=${timeline.credit}; BGM: ${bgmTitles}; ${config.bgmCredit}; ${config.jingleCredit}`, resolve(root, 'top5.m4a')]);

const cardFilters = articleWindows.map(([rank, window], index) => {
  const y = 150 + index * 150;
  return `drawbox=x=150:y=${y}:w=1620:h=110:color=${rank % 2 ? '0xd9583b' : '0x1c6e5a'}@0.9:t=fill:enable='between(t,${window.start},${window.end})'`;
}).join(',');
await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
  `color=c=0x101916:s=1920x1080:r=30:d=${duration}`, '-i', resolve(root, 'top5.m4a'), '-i', srt,
  '-vf', cardFilters || 'null', '-map', '0:v', '-map', '1:a', '-map', '2:s', '-c:v', 'libx264',
  '-preset', 'medium', '-crf', '23', '-c:a', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=jpn',
  '-metadata', `comment=${timeline.credit}; BGM: ${bgmTitles}; ${config.bgmCredit}; ${config.jingleCredit}`,
  '-metadata:s:s:0', `title=字幕・${timeline.credit}`, '-shortest', resolve(root, 'top5.mp4')]);

const publicDir = resolve('generated/public/media', edition.date);
await mkdir(publicDir, { recursive: true });
for (const file of ['top5.m4a', 'top5-no-bgm.m4a', 'top5.mp4']) await copyFile(resolve(root, file), resolve(publicDir, file));
await writeFile(resolve(root, 'media.json'), `${JSON.stringify({ date: edition.date, bgmByTopic: selectedTracks.map((track, index) => ({ topic: index + 1, title: track.title })), bgmCredit: config.bgmCredit, jingleCredit: config.jingleCredit, bgmReductionDb: config.bgmReductionDb, targetLufs: -16, credit: timeline.credit }, null, 2)}\n`);
console.log(`${root} にBGMあり・なし音声と字幕付き動画を生成しました（BGM: ${bgmTitles}）。`);

function stamp(seconds: number) {
  const ms = Math.round(seconds * 1000); const h = Math.floor(ms / 3600000); const m = Math.floor(ms / 60000) % 60; const s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}
function subtitle(value: string) { return value.replace(/\s+/g, ' ').replace(/(.{1,34})(?:。|、|$)/g, '$1\n').trim(); }
function shuffled<T>(values: T[], seedText: string) {
  const result = [...values];
  let seed = [...seedText].reduce((value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const random = () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
function selectThemedTracks(
  articles: Edition['articles'],
  tracks: z.infer<typeof tracksSchema>,
  selection: z.infer<typeof selectionSchema>,
  date: string,
) {
  const byFile = new Map(tracks.map((track) => [track.file, track]));
  const used = new Set<string>();
  return articles.map((article) => {
    const searchable = `${article.title} ${article.categories.join(' ')}`;
    const rule = selection.rules.find((candidate) => candidate.keywords.some((keyword) => article.title.includes(keyword)))
      ?? selection.rules.find((candidate) => candidate.keywords.some((keyword) => searchable.includes(keyword)));
    const candidates = rule
      ? shuffled(rule.tracks, `${date}:${article.id}:${rule.name}`)
      : shuffled(selection.fallbackTracks, `${date}:${article.id}:fallback`);
    const file = candidates.find((candidate) => byFile.has(candidate) && !used.has(candidate))
      ?? candidates.find((candidate) => byFile.has(candidate));
    if (!file) throw new Error(`${article.title}: テーマに合うBGMが見つかりません`);
    used.add(file);
    return byFile.get(file)!;
  });
}
async function run(command: string, args: string[]) { await new Promise<void>((ok, fail) => { const child = spawn(command, args, { stdio: 'inherit' }); child.on('error', fail); child.on('exit', (code) => code === 0 ? ok() : fail(new Error(`${command}: exit ${code}`))); }); }
