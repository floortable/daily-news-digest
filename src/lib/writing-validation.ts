/** 版と単体記事の両方で使う、執筆工程の字数規則。 */
export interface WritingLengthArticle {
  id: string;
  summary: string[];
  comment: string;
  top5Rank: number | null;
}

export interface WritingLengthError {
  field: 'summary' | 'comment';
  message: string;
}

/**
 * 記事自身のフィールドだけで判定できる版レベルの字数規則。
 * 順位は確定台帳から記事へ保存された top5Rank を使うため、単体ゲートでも同じ基準を適用できる。
 */
export function collectWritingLengthErrors(article: WritingLengthArticle, editionDate: string): WritingLengthError[] {
  if (editionDate < '2026-11-01') return [];

  const errors: WritingLengthError[] = [];
  if (article.summary.length !== 3) {
    errors.push({ field: 'summary', message: '方針v2の概要は結論・主要事実・範囲の3段落が必要です' });
  }
  if (article.summary.join('').length < 240) {
    errors.push({ field: 'summary', message: '2026-11-01以降の概要は、埋め草や重複を使わず合計240文字以上が必要です' });
  }

  const minimumCommentLength = editionDate >= '2026-11-12'
    ? (article.top5Rank !== null ? 300 : 150)
    : 300;
  if (article.comment.length < minimumCommentLength) {
    const message = editionDate >= '2026-11-12'
      ? article.top5Rank !== null
        ? '2026-11-12以降のTop 5の独自解説は、概要の再掲を使わず300文字以上が必要です'
        : '2026-11-12以降の非Top 5の中立的な分析と補足は、概要の再掲を使わず150文字以上が必要です'
      : '2026-11-01以降の独自解説は、概要の再掲を使わず300文字以上が必要です';
    errors.push({ field: 'comment', message });
  }
  return errors;
}
