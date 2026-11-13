import type { Edition } from '../src/lib/schema';

/** 新工程のデータ品質ゲート。公開済み版には遡及適用しない。 */
export const EDITORIAL_QUALITY_ENFORCEMENT_DATE = '2026-11-11';
export const UNIFIED_NARRATION_DATE = '2026-11-14';

// 完全一致だけに限定する。固有の出来事を後ろに補った通常の見出しは誤って止めない。
const placeholderTitles = new Set(['本日の更新', '今日の更新', '更新情報', 'ニュース更新']);

function canonicalTitle(title: string): string {
  return title.normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

export function collectTitleQualityErrors(edition: Edition): string[] {
  if (edition.date < EDITORIAL_QUALITY_ENFORCEMENT_DATE) return [];

  const errors: string[] = [];
  const byTitle = new Map<string, string[]>();
  for (const article of edition.articles) {
    const title = canonicalTitle(article.title);
    if (placeholderTitles.has(title)) {
      errors.push(`${edition.date}: 記事 ${article.id} の見出し「${article.title}」は仮置き見出しです`);
    }
    const ids = byTitle.get(title) ?? [];
    ids.push(article.id);
    byTitle.set(title, ids);
  }
  for (const [title, ids] of byTitle) {
    if (ids.length > 1) errors.push(`${edition.date}: 見出し「${title}」が複数記事で重複しています: ${ids.join('、')}`);
  }
  return errors;
}

function narrationSentences(edition: Edition): Array<{ articleId: string; field: string; text: string }> {
  const values: Array<{ articleId: string; field: string; text: string }> = [];
  for (const article of edition.articles) {
    const narration = article.narration;
    if (narration) {
      if (edition.date >= UNIFIED_NARRATION_DATE) {
        narration.script?.forEach((text, index) => values.push({ articleId: article.id, field: `narration.script[${index}]`, text }));
        continue;
      }
      if (narration.result) values.push({ articleId: article.id, field: 'narration.result', text: narration.result });
      for (const field of ['detail', 'learning', 'analysis'] as const) {
        narration[field].forEach((text, index) => values.push({ articleId: article.id, field: `narration.${field}[${index}]`, text }));
      }
      narration.anticipatedQuestions.forEach((item, index) => {
        values.push({ articleId: article.id, field: `narration.anticipatedQuestions[${index}].question`, text: item.question });
        values.push({ articleId: article.id, field: `narration.anticipatedQuestions[${index}].answer`, text: item.answer });
      });
    }
    if (article.attentionAnalysis.currentReaction) {
      values.push({ articleId: article.id, field: 'attentionAnalysis.currentReaction', text: article.attentionAnalysis.currentReaction });
    }
  }
  return values;
}

/**
 * 文末だけを見ることで、引用中の常体や固有名詞を誤検出しない。
 * です・ます調の活用を先に除外し、明確な常体の述語と、台本で不自然な単独応答だけを検出する。
 */
function plainEnding(sentence: string): boolean {
  const trimmed = sentence.trim().replace(/[。！？!?]+$/u, '').trim();
  if (!trimmed || /[」』”’）】〉》]$/u.test(trimmed)) return false;
  if (/(?:です|ます|でした|ました|ません|ましょう|ください|ございます)$/u.test(trimmed)) return false;
  if (/^(?:はい|いいえ|不明|未定|なし)$/u.test(trimmed) || /コメント$/u.test(trimmed)) return true;
  return /(?:だ|である|だった|であった|する|した|している|していた|しない|される|された|なる|なった|ない|いる|いた|べき|必要|可能|不明|困難|重要|対象|状況|予定|見込み|見通し)$/u.test(trimmed);
}

export function collectNarrationStyleErrors(edition: Edition): string[] {
  if (edition.date < EDITORIAL_QUALITY_ENFORCEMENT_DATE) return [];
  const errors: string[] = [];
  for (const value of narrationSentences(edition)) {
    const sentences = value.text.match(/[^。！？!?]+[。！？!?]?/gu) ?? [value.text];
    for (const sentence of sentences) {
      if (plainEnding(sentence)) {
        errors.push(`${edition.date}: 記事 ${value.articleId} の ${value.field} に常体文末があります: ${sentence.trim()}`);
      }
    }
  }
  return errors;
}

export function collectEditorialQualityErrors(edition: Edition): string[] {
  return [...collectTitleQualityErrors(edition), ...collectNarrationStyleErrors(edition)];
}
