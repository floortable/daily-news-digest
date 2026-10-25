import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { readVoicevoxConfig } from './config';
import { getDateArgument, readEdition } from './edition';

const timelineSchema = z.object({
  date: z.iso.date(), credit: z.string(),
  segments: z.array(z.object({ id: z.string(), title: z.string(), speaker: z.string(), start: z.number(), end: z.number() })),
});
const tracksSchema = z.array(z.object({ title: z.string(), file: z.string(), durationSeconds: z.number(), sha256: z.string() }));

const edition = await readEdition(getDateArgument());
const config = await readVoicevoxConfig();
const root = resolve('generated/media', edition.date);
const voice = resolve(root, 'voice/top5-voice.wav');
const timeline = timelineSchema.parse(JSON.parse(await readFile(resolve(root, 'voice/timeline.json'), 'utf8')));
const tracks = tracksSchema.parse(JSON.parse(await readFile(resolve('assets/audio/bgm/tracks.json'), 'utf8')));
const track = tracks[Number(edition.date.replaceAll('-', '')) % tracks.length];
const duration = timeline.segments.at(-1)?.end ?? 1;
const srt = resolve(root, 'top5.srt');
await writeFile(srt, timeline.segments.map((segment, index) =>
  `${index + 1}\n${stamp(segment.start)} --> ${stamp(segment.end)}\n${segment.speaker}：${subtitle(segment.title)}\n`,
).join('\n') + `\n${timeline.segments.length + 1}\n${stamp(Math.max(0, duration - 4))} --> ${stamp(duration)}\n${timeline.credit}\n`);

const noBgmWav = resolve(root, 'top5-no-bgm.wav');
await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', voice,
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', noBgmWav]);
await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', noBgmWav,
  '-c:a', 'aac', '-b:a', '160k', '-metadata', `comment=${timeline.credit}`, resolve(root, 'top5-no-bgm.m4a')]);

const mixedWav = resolve(root, 'top5-mixed.wav');
const bgmGain = 10 ** (-config.bgmReductionDb / 20);
await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-stream_loop', '-1',
  '-i', resolve('assets/audio/bgm', track.file), '-i', voice, '-filter_complex',
  `[0:a]volume=${bgmGain},atrim=0:${duration},afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, duration - 2)}:d=2[bgm];[1:a][bgm]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]`,
  '-map', '[out]', '-ar', '48000', mixedWav]);
await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', mixedWav,
  '-c:a', 'aac', '-b:a', '160k', '-metadata', `title=${timeline.date} 毎日の注目記事 Top 5`,
  '-metadata', `comment=${timeline.credit}; BGM: ${track.title}`, resolve(root, 'top5.m4a')]);

const cardFilters = timeline.segments.filter((s) => s.id.startsWith('rank-')).map((s, index) => {
  const y = 150 + index * 150;
  return `drawbox=x=150:y=${y}:w=1620:h=110:color=${index % 2 ? '0x1c6e5a' : '0xd9583b'}@0.9:t=fill:enable='between(t,${s.start},${s.end})'`;
}).join(',');
await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
  `color=c=0x101916:s=1920x1080:r=30:d=${duration}`, '-i', resolve(root, 'top5.m4a'), '-i', srt,
  '-vf', cardFilters || 'null', '-map', '0:v', '-map', '1:a', '-map', '2:s', '-c:v', 'libx264',
  '-preset', 'medium', '-crf', '23', '-c:a', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=jpn',
  '-metadata:s:s:0', `title=字幕・${timeline.credit}`, '-shortest', resolve(root, 'top5.mp4')]);

const publicDir = resolve('generated/public/media', edition.date);
await mkdir(publicDir, { recursive: true });
for (const file of ['top5.m4a', 'top5-no-bgm.m4a', 'top5.mp4']) await copyFile(resolve(root, file), resolve(publicDir, file));
await writeFile(resolve(root, 'media.json'), `${JSON.stringify({ date: edition.date, bgm: track.title, bgmReductionDb: config.bgmReductionDb, targetLufs: -16, credit: timeline.credit }, null, 2)}\n`);
console.log(`${root} にBGMあり・なし音声と字幕付き動画を生成しました（BGM: ${track.title}）。`);

function stamp(seconds: number) {
  const ms = Math.round(seconds * 1000); const h = Math.floor(ms / 3600000); const m = Math.floor(ms / 60000) % 60; const s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}
function subtitle(value: string) { return value.replace(/\s+/g, ' ').replace(/(.{1,34})(?:。|、|$)/g, '$1\n').trim(); }
async function run(command: string, args: string[]) { await new Promise<void>((ok, fail) => { const child = spawn(command, args, { stdio: 'inherit' }); child.on('error', fail); child.on('exit', (code) => code === 0 ? ok() : fail(new Error(`${command}: exit ${code}`))); }); }
