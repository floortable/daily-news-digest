import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const failures: string[] = [];
if (!existsSync('public/private/vault.json')) failures.push('暗号化保管庫 public/private/vault.json がありません');
if (existsSync('data/daily')) {
  const files = (await readdir('data/daily')).filter((file) => file.endsWith('.json'));
  if (files.length) failures.push(`平文ニュースJSONが残っています: ${files.join(', ')}`);
}
for (const path of ['src/pages/rss.xml.ts', 'src/pages/rss/top5.xml.ts', 'src/pages/rss/vcf.xml.ts']) if (existsSync(path)) failures.push(`認証不能なRSSが残っています: ${path}`);
if (existsSync('public/private/vault.json')) {
  const info = await stat('public/private/vault.json');
  const raw = await readFile('public/private/vault.json', 'utf8');
  const envelope = JSON.parse(raw);
  if (info.size < 1_000 || envelope.version !== 1 || envelope.kdf?.iterations < 600_000 || envelope.cipher?.name !== 'AES-256-GCM') failures.push('暗号化保管庫の形式または強度が不正です');
  if (/"(?:articles|summary|comment|sourceName)"/.test(raw)) failures.push('暗号化保管庫に平文記事データが含まれています');
}
if (failures.length) { console.error(failures.map((failure) => `- ${failure}`).join('\n')); process.exit(1); }
console.log('暗号化保管庫、平文除去、RSS停止を確認しました。');
