import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { aggregateUsage, formatHumanReport } from '../scripts/aggregate-codex-usage';

const temporaryDirectories: string[] = [];

async function fixture(lines: string[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'codex-usage-'));
  temporaryDirectories.push(directory);
  const day = join(directory, '2026', '11', '14');
  await mkdir(day, { recursive: true });
  await writeFile(join(day, 'rollout-synthetic.jsonl'), lines.join('\n'));
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('aggregate-codex-usage', () => {
  it('トークン、最初と最後のrate_limits、壊れた行を集計する', async () => {
    const directory = await fixture([
      JSON.stringify({ payload: { usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 2 } } }),
      JSON.stringify({ payload: { rate_limits: { primary: { used_percent: 12, resets_at: 1_700_000_000 }, secondary: { used_percent: 3, resets_at: 1_700_000_100 } } } }),
      '{ broken JSON',
      JSON.stringify({ payload: { usage: { input_tokens: 7, cached_input_tokens: 1, output_tokens: 5 } } }),
      JSON.stringify({ payload: { rate_limits: { primary: { used_percent: 40, resets_at: 1_700_000_200 }, secondary: { used_percent: 9, resets_at: 1_700_000_300 } } } }),
      JSON.stringify({ payload: { type: 'message-without-usage' } }),
    ]);

    const report = aggregateUsage(directory, ['2026-11-14']);
    expect(report.files).toBe(1);
    expect(report.total).toEqual({ input_tokens: 17, cached_input_tokens: 5, output_tokens: 7 });
    expect(report.daily).toEqual([{ date: '2026-11-14', sessions: 1, usage: report.total }]);
    expect(report.sessions[0].firstRateLimits?.primary).toEqual({ used_percent: 12, resets_at: 1_700_000_000 });
    expect(report.sessions[0].lastRateLimits?.secondary).toEqual({ used_percent: 9, resets_at: 1_700_000_300 });
    expect(report.warnings).toEqual({ malformedLines: 1, eventsWithoutUsage: 3 });
    expect(formatHumanReport(report)).toContain('壊れた行 1件');
  });

  it('対象ファイルがない場合は対象なしとして空の集計を返す', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'codex-usage-'));
    temporaryDirectories.push(directory);
    const report = aggregateUsage(directory, ['2026-11-14']);
    expect(report.files).toBe(0);
    expect(report.total).toEqual({ input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 });
    expect(formatHumanReport(report)).toBe('対象なし: 2026-11-14');
  });
});
