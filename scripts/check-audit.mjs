// Audit gate: fail on high/critical advisories, except an explicit allowlist
// of advisories that currently have no fixed release and are not exploitable
// in this project (static site, build-time only, trusted input).
//
// Allowlist (review when any entry's fix ships, then remove it):
// - GHSA-fc5q-39xc-vjpf (picomatch ReDoS via single-branch repeated extglobs,
//   CVE-2026-112366): every picomatch release through 4.0.7 (the latest) is
//   affected and no fixed npm release exists as of 2026-11-18. picomatch is
//   used only at build time by astro/vite/tinyglobby with glob patterns from
//   this repository itself, never with untrusted input, and nothing from the
//   build toolchain is shipped to the static site. Remove this entry once a
//   fixed picomatch release is available and the lockfile no longer resolves
//   an affected version.
import { spawnSync } from 'node:child_process';

const ALLOWLIST = new Map([
  ['ghsa-fc5q-39xc-vjpf', 'picomatch ReDoS: no fixed release (<=4.0.7 all affected), build-time only, trusted glob input'],
]);

export function evaluateAuditReport(report) {
  const vulns = report.vulnerabilities ?? {};
  const blocking = [];
  const allowed = [];
  for (const [name, entry] of Object.entries(vulns)) {
    if (entry.severity !== 'high' && entry.severity !== 'critical') continue;
    const ids = new Set();
    for (const via of entry.via ?? []) {
      if (typeof via === 'object' && via !== null) {
        const text = `${via.url ?? ''} ${via.title ?? ''}`;
        for (const match of text.matchAll(/GHSA-[a-z0-9-]+/gi)) ids.add(match[0].toLowerCase());
      }
    }
    // Transitive entries whose `via` is only package names carry no advisory
    // id of their own; the direct entry for that advisory is evaluated too.
    if (ids.size === 0) continue;
    const nonAllowed = [...ids].filter((id) => !ALLOWLIST.has(id));
    if (nonAllowed.length === 0) {
      for (const id of ids) allowed.push(`${name}: ${id}`);
    } else {
      blocking.push(`${name} (${entry.severity}): ${nonAllowed.join(', ')}`);
    }
  }
  return { blocking, allowed };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const run = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  let report;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    console.error('check-audit: could not parse `npm audit --json` output; failing closed.');
    if (run.stdout) console.error(run.stdout.slice(0, 2000));
    if (run.stderr) console.error(run.stderr.slice(0, 2000));
    process.exit(1);
  }
  const { blocking, allowed } = evaluateAuditReport(report);
  for (const line of allowed) {
    const id = line.split(': ')[1];
    console.warn(`check-audit: allowing ${line} — ${ALLOWLIST.get(id)}`);
  }
  if (blocking.length > 0) {
    console.error('check-audit: blocking high/critical advisories found:');
    for (const line of blocking) console.error(`  - ${line}`);
    process.exit(1);
  }
  console.log('check-audit: no blocking high/critical advisories.');
}
