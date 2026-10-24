import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { editionSchema } from '../src/lib/schema';

const ITERATIONS = 600_000;

async function hiddenPrompt(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('安全な対話入力にはTTYが必要です');
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  return await new Promise((resolvePrompt, reject) => {
    let value = '';
    const onData = (key: string) => {
      if (key === '\u0003') { cleanup(); reject(new Error('中断しました')); return; }
      if (key === '\r' || key === '\n') { cleanup(); process.stdout.write('\n'); resolvePrompt(value); return; }
      if (key === '\u007f' || key === '\b') { value = value.slice(0, -1); return; }
      if (key >= ' ') value += key;
    };
    const cleanup = () => { process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); };
    process.stdin.on('data', onData);
  });
}

const first = await hiddenPrompt('暗号化パスフレーズ（16文字以上、画面には表示されません）: ');
if (first.length < 16) throw new Error('パスフレーズは16文字以上必要です');
const second = await hiddenPrompt('確認のため再入力: ');
if (first !== second) throw new Error('パスフレーズが一致しません');

const directory = resolve('private-data/daily');
const files = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
const editions = [];
for (const file of files) editions.push(editionSchema.parse(JSON.parse(await readFile(resolve(directory, file), 'utf8'))));

const salt = randomBytes(32);
const iv = randomBytes(12);
const key = pbkdf2Sync(first, salt, ITERATIONS, 32, 'sha256');
const plaintext = gzipSync(Buffer.from(JSON.stringify({ version: 1, editions }), 'utf8'), { level: 9 });
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const tag = cipher.getAuthTag();
key.fill(0);

const envelope = {
  version: 1,
  kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: salt.toString('base64') },
  cipher: { name: 'AES-256-GCM', iv: iv.toString('base64'), tag: tag.toString('base64') },
  compression: 'gzip',
  ciphertext: ciphertext.toString('base64'),
};
const outputDirectory = resolve('public/private');
const output = resolve(outputDirectory, 'vault.json');
await mkdir(outputDirectory, { recursive: true });
await writeFile(output, JSON.stringify(envelope), { mode: 0o600 });
await chmod(output, 0o600);
console.log(`${editions.length}日分・${editions.reduce((sum, edition) => sum + edition.articles.length, 0)}記事を暗号化しました。パスフレーズは保存していません。`);
