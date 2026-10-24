import { readFile } from 'node:fs/promises';

type LockedPackage = { name?: string; version?: string; license?: string };
const lock = JSON.parse(await readFile('package-lock.json', 'utf8')) as { packages: Record<string, LockedPackage> };
const failures: string[] = [];
const licenses = new Map<string, number>();
const forbidden = /(?:^|\s|\()(?:(?:A|SS)GPL(?:-|$)|BUSL|Commons-Clause|NonCommercial|UNLICENSED|SEE LICENSE)/i;

for (const [path, pkg] of Object.entries(lock.packages)) {
  if (!path || !path.startsWith('node_modules/')) continue;
  const identity = `${pkg.name ?? path.replace(/^node_modules\//, '')}@${pkg.version ?? 'unknown'}`;
  if (!pkg.license) failures.push(`${identity}: license metadataなし`);
  else {
    licenses.set(pkg.license, (licenses.get(pkg.license) ?? 0) + 1);
    if (forbidden.test(pkg.license)) failures.push(`${identity}: 要事前法務確認ライセンス ${pkg.license}`);
  }
}

if (failures.length) {
  console.error('依存ライセンスチェックに失敗しました:\n' + failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}
console.log('依存ライセンスチェックに成功しました: ' + [...licenses.entries()].map(([name, count]) => `${name}=${count}`).join(', '));
