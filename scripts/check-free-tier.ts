import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const workflowDirectory = resolve('.github/workflows');
const files = (await readdir(workflowDirectory)).filter((name) => /\.ya?ml$/.test(name));
const violations: string[] = [];

for (const file of files) {
  const content = await readFile(resolve(workflowDirectory, file), 'utf8');
  const runners = [...content.matchAll(/^\s*runs-on:\s*(.+?)\s*$/gm)].map((match) => match[1]);
  for (const runner of runners) {
    if (runner !== 'ubuntu-latest') violations.push(`${file}: 標準ubuntu-latest以外のrunner (${runner})`);
  }
  if (/\$\{\{\s*secrets\./.test(content)) violations.push(`${file}: 外部secretへの参照`);
  if (/OPENAI|ANTHROPIC|GEMINI|CLAUDE|PAID_API/i.test(content)) violations.push(`${file}: 課金APIを示す設定`);
}

if (violations.length) throw new Error(`無料運用ポリシー違反:\n${violations.join('\n')}`);
console.log(`${files.length}件のworkflowが無料運用ポリシーに適合しています。`);
