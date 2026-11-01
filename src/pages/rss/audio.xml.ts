import { buildPodcastFeed } from '../../lib/podcast-feed';

export function GET(context: { site?: URL }) {
  return new Response(buildPodcastFeed(context.site), {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
}
