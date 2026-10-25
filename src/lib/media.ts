import published from '../../config/published-media.json';

export function getMediaUrls(base: string, date: string) {
  const root = `${base.endsWith('/') ? base : `${base}/`}media/${date}/`;
  return { audio: `${root}top5.m4a`, audioNoBgm: `${root}top5-no-bgm.m4a`, video: `${root}top5.mp4` };
}

export function isMediaPublished(date: string) {
  return published.editions.includes(date as never);
}
