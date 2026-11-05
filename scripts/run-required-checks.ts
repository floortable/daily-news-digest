import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const checks = [
  ['validate:data'], ['test'], ['build'], ['check:free-tier'], ['check:licenses'], ['check:public-safety'],
];

function tail(value: string, lines = 60) {
  return value.split('\n').slice(-lines).join('\n').trim();
}

for (const [script] of checks) {
  const startedAt = Date.now();
  const result = spawnSync(npm, ['run', script], { encoding: 'utf8', env: process.env, maxBuffer: 32 * 1024 * 1024 });
  const durationMs = Date.now() - startedAt;
  if (result.status !== 0) {
    console.error(JSON.stringify({ script, status: 'failed', exitCode: result.status, durationMs }));
    const output = tail(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
    if (output) console.error(output);
    process.exit(result.status ?? 1);
  }
  console.log(JSON.stringify({ script, status: 'passed', durationMs }));
}
