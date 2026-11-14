import { describe, expect, it } from 'vitest';
import { collectFacts, evaluateClaims } from '../scripts/verify-advisory-ids';

describe('advisory:verify', () => {
  it('一次情報を事実モードの形へ整形する', async () => {
    const facts = await collectFacts(['CVE-2026-12345', '123456'], async (url) => {
      if (url.includes('known_exploited')) return { vulnerabilities: [{ cveID: 'CVE-2026-12345', vendorProject: 'Example Vendor', dateAdded: '2026-11-13', dueDate: '2026-12-01' }] };
      if (url.includes('cveawg')) return { cveMetadata: { cveId: 'CVE-2026-12345' } };
      return { note: 'VU includes CVE-2026-12345' };
    });
    expect(facts).toEqual([
      { id: 'CVE-2026-12345', type: 'cve', status: 'ok', recordExists: true, kevListed: true, dueDate: '2026-12-01' },
      { id: 'VU#123456', type: 'vu', status: 'ok', cves: ['CVE-2026-12345'] },
    ]);
  });

  it('主張を pass と fail に判定する', () => {
    const facts = [
      { id: 'VU#123456', type: 'vu' as const, status: 'ok' as const, cves: ['CVE-2026-12345'] },
      { id: 'CVE-2026-12345', type: 'cve' as const, status: 'ok' as const, recordExists: true, kevListed: true, dueDate: '2026-12-01' },
    ];
    const results = evaluateClaims([
      { type: 'vu-has-cve', id: '123456', cve: 'CVE-2026-12345' },
      { type: 'vu-no-cve', id: '123456' },
      { type: 'kev-due', id: 'CVE-2026-12345', date: '2026-12-01' },
    ], facts);
    expect(results.map((result) => result.status)).toEqual(['pass', 'fail', 'pass']);
  });
});
