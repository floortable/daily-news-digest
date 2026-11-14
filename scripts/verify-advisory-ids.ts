/** CVE、KEV、CERT/CC VU の一次情報を照合する。 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
type FetchJson = (url: string) => Promise<unknown>;
export type AdvisoryFact = { id: string; type: 'cve' | 'vu'; status: 'ok' | 'unavailable'; recordExists?: boolean; kevListed?: boolean; dueDate?: string | null; cves?: string[]; error?: string };

export function normalizeId(value: string): { id: string; type: 'cve' | 'vu' } {
  const upper = value.toUpperCase();
  if (/^CVE-\d{4}-\d{4,}$/.test(upper)) return { id: upper, type: 'cve' };
  const vu = upper.replace(/^VU#?/, '');
  if (/^\d+$/.test(vu)) return { id: `VU#${vu}`, type: 'vu' };
  throw new Error(`未対応のIDです: ${value}`);
}

export const fetchJson: FetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
};

function cvesIn(value: unknown): string[] {
  return [...new Set(JSON.stringify(value).match(/CVE-\d{4}-\d{4,}/gi)?.map((id) => id.toUpperCase()) ?? [])];
}

function vinceCves(record: unknown): string[] {
  if (record && typeof record === 'object' && Array.isArray((record as { cveids?: unknown }).cveids)) {
    return [...new Set((record as { cveids: unknown[] }).cveids
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.toUpperCase()))];
  }
  return cvesIn(record);
}

export async function collectFacts(ids: string[], getJson: FetchJson = fetchJson): Promise<AdvisoryFact[]> {
  const normalized = ids.map(normalizeId);
  let kev: unknown | undefined;
  let kevError: string | undefined;
  if (normalized.some((item) => item.type === 'cve')) {
    try { kev = await getJson(KEV_URL); } catch (error) { kevError = error instanceof Error ? error.message : String(error); }
  }
  return Promise.all(normalized.map(async ({ id, type }): Promise<AdvisoryFact> => {
    try {
      if (type === 'vu') {
        const record = await getJson(`https://www.kb.cert.org/vuls/api/${id.slice(3)}/`);
        return { id, type, status: 'ok', cves: vinceCves(record) };
      }
      const record = await getJson(`https://cveawg.mitre.org/api/cve/${id}`);
      if (kevError) return { id, type, status: 'unavailable', error: `KEV catalog: ${kevError}` };
      const entry = (kev as { vulnerabilities?: Array<{ cveID?: string; dueDate?: string }> }).vulnerabilities?.find((item) => item.cveID?.toUpperCase() === id);
      return { id, type, status: 'ok', recordExists: Boolean(record), kevListed: Boolean(entry), dueDate: entry?.dueDate ?? null };
    } catch (error) {
      return { id, type, status: 'unavailable', error: error instanceof Error ? error.message : String(error) };
    }
  }));
}

type Claim = { type: string; id: string; cve?: string; date?: string };
export function evaluateClaims(claims: Claim[], facts: AdvisoryFact[]) {
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  return claims.map((claim) => {
    let normalized: { id: string; type: 'cve' | 'vu' };
    try { normalized = normalizeId(claim.id); } catch (error) { return { claim, status: 'fail', evidence: String(error) }; }
    const fact = byId.get(normalized.id);
    if (!fact || fact.status === 'unavailable') return { claim, status: 'unavailable', evidence: fact?.error ?? '一次情報を取得できませんでした' };
    const cve = claim.cve?.toUpperCase();
    let pass = false;
    switch (claim.type) {
      case 'vu-no-cve': pass = fact.type === 'vu' && fact.cves?.length === 0; break;
      case 'vu-has-cve': pass = fact.type === 'vu' && !!cve && fact.cves?.includes(cve) === true; break;
      case 'kev-due': pass = fact.type === 'cve' && fact.kevListed === true && fact.dueDate === claim.date; break;
      case 'kev-listed': pass = fact.type === 'cve' && fact.kevListed === true; break;
      case 'not-kev-listed': pass = fact.type === 'cve' && fact.kevListed === false; break;
      default: return { claim, status: 'fail', evidence: `未対応の主張型です: ${claim.type}` };
    }
    return { claim, status: pass ? 'pass' : 'fail', evidence: fact };
  });
}

function valueAfter(flag: string): string | undefined { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; }
async function main(): Promise<void> {
  const claimsPath = valueAfter('--claims');
  if (claimsPath) {
    const claims = JSON.parse(await readFile(claimsPath, 'utf8')) as Claim[];
    if (!Array.isArray(claims)) throw new Error('claims.json は主張の配列である必要があります');
    const facts = await collectFacts(claims.map((claim) => claim.id));
    const results = evaluateClaims(claims, facts);
    console.log(JSON.stringify({ facts, claims: results }, null, 2));
    process.exitCode = results.some((result) => result.status === 'unavailable') ? 2 : results.some((result) => result.status === 'fail') ? 1 : 0;
    return;
  }
  const ids = process.argv.slice(2).filter((value) => !value.startsWith('--'));
  if (!ids.length) throw new Error('使い方: verify-advisory-ids.ts <CVE|VU...> | --claims claims.json');
  console.log(JSON.stringify(await collectFacts(ids), null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
