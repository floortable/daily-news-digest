import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const failures: string[] = [];
const runGit = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const files = runGit('ls-files').trim().split('\n').filter(Boolean);

const forbiddenNames = /(^|\/)(\.env($|\.)|\.npmrc$|\.netrc$|id_(rsa|ed25519)$|credentials($|\.)|.*\.(pem|key|p12|pfx|keystore)$)/i;
const secretPatterns: Array<[string, RegExp]> = [
  ['秘密鍵', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['AWSアクセスキー', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHubトークン', /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['APIキーらしき値', /\b(?:sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,})\b/],
  ['URL埋込み認証', /https?:\/\/[^\s/@:]+:[^\s/@]+@/],
  ['ローカルホームパス', /(?:\/Users\/[^/\s]+|\/home\/[^/\s]+)/],
  ['メールアドレス', /\b[A-Z0-9._%+-]+@(?!users\.noreply\.github\.com\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
];

for (const file of files) {
  if (!existsSync(file)) continue;
  if (forbiddenNames.test(file) && !/\.env\.example$/i.test(file)) failures.push(`${file}: 公開禁止ファイル名`);
  const buffer = await readFile(file);
  if (buffer.includes(0) || buffer.length > 2_000_000) continue;
  const content = buffer.toString('utf8');
  for (const [label, pattern] of secretPatterns) if (pattern.test(content)) failures.push(`${file}: ${label}`);
  if (file.startsWith('.github/workflows/')) {
    if (/pull_request_target\s*:|permissions\s*:\s*write-all|\$\{\{\s*secrets\.|runs-on\s*:\s*self-hosted/i.test(content)) failures.push(`${file}: 危険なActions設定`);
    if (/persist-credentials\s*:\s*true/i.test(content)) failures.push(`${file}: checkout資格情報が永続化されています`);
    for (const match of content.matchAll(/uses:\s*([^\s#]+)/g)) if (!match[1].startsWith('actions/')) failures.push(`${file}: 許可されていないAction ${match[1]}`);
  }
}

const authors = runGit('log', 'HEAD', '--tags', '--format=%ae').trim().split('\n').filter(Boolean);
for (const email of new Set(authors)) if (!email.endsWith('@users.noreply.github.com')) failures.push(`Git履歴: 公開用ではないauthor email ${email}`);

const history = runGit('log', 'HEAD', '--tags', '-p', '--no-ext-diff', '--no-color');
for (const [label, pattern] of secretPatterns.slice(0, 6)) if (pattern.test(history)) failures.push(`Git履歴: ${label}`);

if (failures.length) {
  console.error('Public公開安全性チェックに失敗しました:\n' + [...new Set(failures)].map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}
console.log(`${files.length}ファイルとGit履歴のPublic公開安全性チェックに成功しました。`);
