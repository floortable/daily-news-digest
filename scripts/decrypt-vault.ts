import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { editionSchema } from '../src/lib/schema';

async function hiddenPrompt(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('安全な対話入力にはTTYが必要です');
  process.stdout.write(label); process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  return await new Promise((resolvePrompt, reject) => { let value = ''; const cleanup = () => { process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); }; const onData = (key: string) => { if (key === '\u0003') { cleanup(); reject(new Error('中断しました')); } else if (key === '\r' || key === '\n') { cleanup(); process.stdout.write('\n'); resolvePrompt(value); } else if (key === '\u007f' || key === '\b') value = value.slice(0, -1); else if (key >= ' ') value += key; }; process.stdin.on('data', onData); });
}

const envelope = JSON.parse(await readFile(resolve('public/private/vault.json'), 'utf8'));
const secret = await hiddenPrompt('復号パスフレーズ（画面には表示されません）: ');
const key = pbkdf2Sync(secret, Buffer.from(envelope.kdf.salt, 'base64'), envelope.kdf.iterations, 32, 'sha256');
const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.cipher.iv, 'base64'));
decipher.setAuthTag(Buffer.from(envelope.cipher.tag, 'base64'));
let plaintext: Buffer;
try { plaintext = gunzipSync(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()])); }
catch { key.fill(0); throw new Error('復号できませんでした。パスフレーズを確認してください'); }
key.fill(0);
const payload = JSON.parse(plaintext.toString('utf8'));
const output = resolve('private-data/daily'); await mkdir(output, { recursive: true });
for (const raw of payload.editions) { const edition = editionSchema.parse(raw); const path = resolve(output, `${edition.date}.json`); await writeFile(path, JSON.stringify(edition, null, 2) + '\n', { mode: 0o600 }); await chmod(path, 0o600); }
console.log(`${payload.editions.length}日分をGit管理対象外のprivate-data/dailyへ復号しました。`);
