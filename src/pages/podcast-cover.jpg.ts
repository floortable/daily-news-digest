import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function GET() {
  const artwork = await readFile(resolve('assets/podcast/show-cover.jpg'));
  return new Response(artwork, {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=86400',
    },
  });
}
