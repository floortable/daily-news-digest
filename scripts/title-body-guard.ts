/**
 * 見出しと本文の題材対応を確認する、依存なしの決定的ガード。
 * 漢字だけの見出しは形態素解析を行わないため判定不能（警告）に留める。
 */
export interface GuardArticle {
  id: string;
  title: string;
  summary: string[];
  narration?: {
    result?: string;
    detail?: string[];
    learning?: string[];
    analysis?: string[];
  } | null;
}

export interface GuardEdition { date: string; articles: GuardArticle[]; strictNarration?: boolean; }
export interface AlignmentResult {
  articleId: string;
  tokens: string[];
  summaryMatched: string[];
  narrationMatched: Record<string, string[]> | null;
}

const normalize = (text: string) => text.normalize('NFKC');

/** CVE、英数字の製品名・版・略称、カタカナ語を題材アンカーとして使う。 */
export function extractAnchorTokens(title: string): string[] {
  const tokens = new Set<string>();
  const text = normalize(title);
  const nonDiscriminative = new Set(['インフラ', 'SNS', 'ケア', 'ジムアプリ', 'エネ', 'KPI']);
  for (const match of text.matchAll(/CVE-\d{4}-\d{4,7}/gi)) tokens.add(match[0].toUpperCase());
  for (const match of text.matchAll(/[A-Za-z0-9]+(?:[.+-][A-Za-z0-9]+)*/g)) {
    const token = match[0];
    // 年だけ、順位だけ、日付の断片は題材を表さず、誤警告の原因になる。
    if (/^\d{1,4}$/.test(token) || nonDiscriminative.has(token)) continue;
    if (token.length >= 2 || /\d/.test(token)) tokens.add(token);
  }
  for (const match of text.matchAll(/[ァ-ヶー]{2,}/g)) {
    const token = match[0];
    if (token.length >= 2 && !nonDiscriminative.has(token)) tokens.add(token);
  }
  return [...tokens];
}

function appears(token: string, text: string): boolean {
  // 表記ゆれは題材の不一致ではない。固有の略称だけを限定して吸収する。
  const aliases: Record<string, string[]> = {
    Bitcoin: ['ビットコイン'],
    'GMO-PG': ['GMOペイメントゲートウェイ'],
    ウェブページ: ['ウェブサイト', 'Webサイト'],
    VTuber: ['バーチャルYouTuber', 'ホロライブ'],
  };
  if ((aliases[token] ?? []).some((alias) => text.toLowerCase().includes(alias.toLowerCase()))) return true;
  if (/^[ァ-ヶー]+$/u.test(token)) return text.includes(token);
  if (/^CVE-/i.test(token)) return text.toUpperCase().includes(token);
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (token.length <= 2) return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'i').test(text);
  if (/^\d+(?:\.\d+)+$/.test(token)) {
    if (text.toLowerCase().includes(token.toLowerCase())) return true;
    const segments = token.split('.');
    while (segments.length > 2) {
      segments.pop();
      if (text.toLowerCase().includes(segments.join('.').toLowerCase())) return true;
    }
    return false;
  }
  if (text.toLowerCase().includes(token.toLowerCase())) return true;
  return false;
}

export function checkArticleAlignment(article: GuardArticle): AlignmentResult {
  const tokens = extractAnchorTokens(article.title);
  const matched = (text: string) => tokens.filter((token) => appears(token, normalize(text)));
  const narration = article.narration;
  const narrationMatched = narration ? {
    result: matched(narration.result ?? ''),
    detail: matched((narration.detail ?? []).join('\n')),
    learning: matched((narration.learning ?? []).join('\n')),
    analysis: matched((narration.analysis ?? []).join('\n')),
  } : null;
  return { articleId: article.id, tokens, summaryMatched: matched((article.summary ?? []).join('\n')), narrationMatched };
}

export function collectTitleBodyWarnings(edition: GuardEdition): string[] {
  const warnings: string[] = [];
  for (const article of edition.articles) {
    const result = checkArticleAlignment(article);
    if (!result.tokens.length) {
      warnings.push(`${edition.date}: 記事 ${article.id} は見出しからアンカートークンを抽出できず判定不能です`);
      continue;
    }
    if (result.summaryMatched.length) {
      const ratio = result.summaryMatched.length / result.tokens.length;
      if (ratio < 0.5) warnings.push(`${edition.date}: 記事 ${article.id} の見出しと summary の一致率が低めです（${result.summaryMatched.length}/${result.tokens.length}、一致: ${result.summaryMatched.join('、')}）`);
    }
    if (result.narrationMatched !== null && Object.values(result.narrationMatched).every((matched) => !matched.length)) {
      warnings.push(`${edition.date}: 記事 ${article.id} の narration は固有アンカーを反復していません（既存台本の文脈依存を確認）`);
    }
  }
  return warnings;
}

/** 重なりゼロだけを fail とし、0.5 未満は較正用の警告に留める。 */
export function collectTitleBodyErrors(edition: GuardEdition): string[] {
  const errors: string[] = [];
  for (const article of edition.articles) {
    const result = checkArticleAlignment(article);
    if (!result.tokens.length) continue;
    if (!result.summaryMatched.length) errors.push(`${edition.date}: 記事 ${article.id} の見出しと summary の題材が一致しません（見出しトークン: ${result.tokens.join('、')}）`);
    // 2026-11-10の工程切替以前の台本は、学び・分析で固有名を反復しない方針だった。
    // 既存公開版は全欄を走査して警告を出すだけにし、新工程の版と単体記事では各欄を fail にする。
    const strictNarration = edition.strictNarration || edition.date >= '2026-11-10';
    if (strictNarration && result.narrationMatched) {
      for (const [field, matched] of Object.entries(result.narrationMatched)) {
        if (!matched.length) errors.push(`${edition.date}: 記事 ${article.id} の見出しと narration.${field} の題材が一致しません（見出しトークン: ${result.tokens.join('、')}）`);
      }
    }
  }
  return errors;
}

async function main(): Promise<void> {
  const { readFile } = await import('node:fs/promises');
  const args = process.argv.slice(2);
  const single = args.includes('--single');
  const verbose = args.includes('--verbose');
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file) throw new Error('使い方: title-body-guard.ts <edition.json> [--verbose] / <article.json> --single');
  const parsed = JSON.parse(await readFile(file, 'utf8'));
  const edition: GuardEdition = single ? { date: parsed.editionDate ?? 'single', articles: [parsed], strictNarration: true } : parsed;
  for (const article of edition.articles) if (verbose) console.log(JSON.stringify(checkArticleAlignment(article), null, 2));
  for (const warning of collectTitleBodyWarnings(edition)) console.warn(`警告: ${warning}`);
  const errors = collectTitleBodyErrors(edition);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`${edition.date}: 全${edition.articles.length}記事の見出しと本文の題材一致を確認しました。`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
