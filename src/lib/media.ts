import published from '../../config/published-media.json';

export function getMediaUrls(base: string, date: string) {
  const entry = getPublishedMedia(date);
  if (entry) return { audio: entry.audio, audioNoBgm: entry.audioNoBgm, video: entry.video };
  const root = `${base.endsWith('/') ? base : `${base}/`}media/${date}/`;
  return { audio: `${root}top5.m4a`, audioNoBgm: `${root}top5-no-bgm.m4a`, video: `${root}top5.mp4` };
}

export function isMediaPublished(date: string) {
  return Boolean(getPublishedMedia(date));
}

export function getPublishedMedia(date: string) {
  return published.editions.find((entry) => entry.date === date);
}
