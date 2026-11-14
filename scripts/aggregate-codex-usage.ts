import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

type TokenUsage = {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
};

type RateWindow = {
  used_percent: number | null;
  resets_at: number | string | null;
};

export type RateLimits = {
  primary: RateWindow | null;
  secondary: RateWindow | null;
};

export type SessionUsage = {
  date: string;
  session: string;
  usage: TokenUsage;
  firstRateLimits: RateLimits | null;
  lastRateLimits: RateLimits | null;
};

export type UsageReport = {
  dates: string[];
  files: number;
  sessions: SessionUsage[];
  daily: Array<{ date: string; sessions: number; usage: TokenUsage }>;
  total: TokenUsage;
  warnings: { malformedLines: number; eventsWithoutUsage: number };
};

type JsonObject = Record<string, unknown>;

const emptyUsage = (): TokenUsage => ({ input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 });

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readUsage(value: unknown): TokenUsage | null {
  if (!isObject(value)) return null;
  const fields = ['input_tokens', 'cached_input_tokens', 'output_tokens'] as const;
  if (!fields.some((field) => typeof value[field] === 'number')) return null;
  return Object.fromEntries(fields.map((field) => [field, typeof value[field] === 'number' ? value[field] : 0])) as TokenUsage;
}

function readRateWindow(value: unknown): RateWindow | null {
  if (!isObject(value)) return null;
  const usedPercent = value.used_percent;
  const resetsAt = value.resets_at;
  if (typeof usedPercent !== 'number' && typeof resetsAt !== 'number' && typeof resetsAt !== 'string') return null;
  return {
    used_percent: typeof usedPercent === 'number' ? usedPercent : null,
    resets_at: typeof resetsAt === 'number' || typeof resetsAt === 'string' ? resetsAt : null,
  };
}

function readRateLimits(value: unknown): RateLimits | null {
  if (!isObject(value)) return null;
  const primary = readRateWindow(value.primary);
  const secondary = readRateWindow(value.secondary);
  return primary || secondary ? { primary, secondary } : null;
}

function addUsage(target: TokenUsage, source: TokenUsage): void {
  target.input_tokens += source.input_tokens;
  target.cached_input_tokens += source.cached_input_tokens;
  target.output_tokens += source.output_tokens;
}

function datePath(sessionsDir: string, date: string): string {
  const [year, month, day] = date.split('-');
  return join(sessionsDir, year, month, day);
}

function validateDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`日付は YYYY-MM-DD 形式で指定してください: ${date}`);
  }
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`日付は YYYY-MM-DD 形式で指定してください: ${date}`);
  }
  return date;
}

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function defaultDates(now = new Date()): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - index);
    return localDateString(date);
  }).reverse();
}

export function aggregateUsage(sessionsDir: string, requestedDates: string[]): UsageReport {
  const dates = requestedDates.map(validateDate);
  const sessions: SessionUsage[] = [];
  const warnings = { malformedLines: 0, eventsWithoutUsage: 0 };

  for (const date of dates) {
    const directory = datePath(sessionsDir, date);
    if (!existsSync(directory)) continue;
    for (const file of readdirSync(directory).filter((name) => /^rollout-.*\.jsonl$/.test(name)).sort()) {
      const usage = emptyUsage();
      let firstRateLimits: RateLimits | null = null;
      let lastRateLimits: RateLimits | null = null;
      for (const line of readFileSync(join(directory, file), 'utf8').split(/\r?\n/)) {
        if (!line.trim()) continue;
        let event: JsonObject;
        try {
          const parsed: unknown = JSON.parse(line);
          if (!isObject(parsed)) throw new Error('JSON object expected');
          event = parsed;
        } catch {
          warnings.malformedLines += 1;
          continue;
        }
        const payload = isObject(event.payload) ? event.payload : null;
        const rateLimits = readRateLimits(payload?.rate_limits);
        if (rateLimits) {
          firstRateLimits ??= rateLimits;
          lastRateLimits = rateLimits;
        }
        // Codex emits per-event consumption here. Other usage-like fields are cumulative snapshots.
        const eventUsage = readUsage(payload?.usage);
        if (!eventUsage) {
          warnings.eventsWithoutUsage += 1;
          continue;
        }
        addUsage(usage, eventUsage);
      }
      sessions.push({ date, session: basename(file), usage, firstRateLimits, lastRateLimits });
    }
  }

  const dailyMap = new Map<string, { sessions: number; usage: TokenUsage }>();
  for (const date of dates) dailyMap.set(date, { sessions: 0, usage: emptyUsage() });
  const total = emptyUsage();
  for (const session of sessions) {
    const day = dailyMap.get(session.date)!;
    day.sessions += 1;
    addUsage(day.usage, session.usage);
    addUsage(total, session.usage);
  }
  return {
    dates,
    files: sessions.length,
    sessions,
    daily: [...dailyMap.entries()].map(([date, value]) => ({ date, ...value })),
    total,
    warnings,
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatReset(value: RateWindow['resets_at']): string {
  if (typeof value !== 'number') return value ?? '-';
  const milliseconds = value < 10_000_000_000 ? value * 1_000 : value;
  const date = new Date(milliseconds);
  return Number.isNaN(date.valueOf()) ? String(value) : date.toISOString();
}

function formatRateLimits(limits: RateLimits | null): string {
  if (!limits) return '-';
  const formatWindow = (name: string, window: RateWindow | null) =>
    window ? `${name} ${window.used_percent ?? '-'}% / ${formatReset(window.resets_at)}` : `${name} -`;
  return `${formatWindow('P', limits.primary)}; ${formatWindow('S', limits.secondary)}`;
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => row[index].length)));
  const row = (values: string[]) => values.map((value, index) => value.padEnd(widths[index])).join('  ');
  return [row(headers), row(widths.map((width) => '-'.repeat(width))), ...rows.map(row)].join('\n');
}

export function formatHumanReport(report: UsageReport): string {
  if (report.files === 0) return `対象なし: ${report.dates.join(', ')}`;
  const sessions = table(
    ['日付', 'セッション', 'input', 'cached', 'output', '最初の rate_limits', '最後の rate_limits'],
    report.sessions.map((session) => [
      session.date,
      session.session,
      formatNumber(session.usage.input_tokens),
      formatNumber(session.usage.cached_input_tokens),
      formatNumber(session.usage.output_tokens),
      formatRateLimits(session.firstRateLimits),
      formatRateLimits(session.lastRateLimits),
    ]),
  );
  const daily = table(
    ['日付', 'sessions', 'input', 'cached', 'output'],
    report.daily.map((day) => [day.date, String(day.sessions), formatNumber(day.usage.input_tokens), formatNumber(day.usage.cached_input_tokens), formatNumber(day.usage.output_tokens)]),
  );
  return [
    'セッション別', sessions, '', '日別合計', daily, '',
    `全体合計: input ${formatNumber(report.total.input_tokens)}, cached ${formatNumber(report.total.cached_input_tokens)}, output ${formatNumber(report.total.output_tokens)}`,
    `警告: 壊れた行 ${report.warnings.malformedLines}件、usage を持たないイベント ${report.warnings.eventsWithoutUsage}件`,
  ].join('\n');
}

type Options = { sessionsDir: string; dates: string[]; json: boolean };

function parseArgs(args: string[]): Options {
  const dates: string[] = [];
  let sessionsDir = process.env.CODEX_SESSIONS_DIR || join(homedir(), '.codex', 'sessions');
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') json = true;
    else if (arg === '--sessions-dir') {
      const value = args[++index];
      if (!value) throw new Error('--sessions-dir にはディレクトリを指定してください');
      sessionsDir = value;
    } else if (arg === '--date') {
      const value = args[++index];
      if (!value) throw new Error('--date には YYYY-MM-DD を指定してください');
      dates.push(value);
    } else if (arg === '--help' || arg === '-h') {
      console.log('使い方: tsx scripts/aggregate-codex-usage.ts [--sessions-dir DIR] [--date YYYY-MM-DD ...] [--json]');
      process.exit(0);
    } else if (arg.startsWith('-')) throw new Error(`不明な引数です: ${arg}`);
    else dates.push(arg);
  }
  return { sessionsDir, dates: dates.length ? dates : defaultDates(), json };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const report = aggregateUsage(options.sessionsDir, options.dates);
  console.log(options.json ? JSON.stringify(report, null, 2) : formatHumanReport(report));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
