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

/** 生成時の実物から抽出した、記事そのものについて語る定型フレーム。 */
export const forbiddenArticleMetaFrames = [
  '見出しだけで広げず',
  'に関する掲載内容を',
  '掲載内容を読む際の中心的な観点',
  'を読む価値は',
  'という判断材料にある',
  'という一点から、実際に確認すべき対象と',
] as const;

export interface ArticleQualityArticle extends WritingLengthArticle {
  title: string;
  attentionAnalysis?: { whyNotable: string };
  articleDetail?: {
    facts: string[];
    explanation: string[];
    implications: string[];
    nextChecks: string[];
  };
}

export interface ArticleQualityError {
  field: string;
  message: string;
}

const normalizeTitleComparison = (value: string) => value
  .normalize('NFKC')
  .replace(/[\s　「」『』【】（）()、。,:：・]/gu, '')
  .toLowerCase();

export function isSourceTitleOnlyFact(fact: string, title: string): boolean {
  const normalizedFact = normalizeTitleComparison(fact);
  const normalizedTitle = normalizeTitleComparison(title);
  if (normalizedFact === normalizedTitle) return true;
  // 「見出し：<title>」のようにラベルだけを足したコピーも、出来事の事実にはならない。
  const remainder = normalizedFact.replace(normalizedTitle, '');
  return /^(?:記事)?(?:見出し|タイトル|出典)(?:は)?$/u.test(remainder);
}

/**
 * 記事単体で確認できる、方針v2の内容充足規則。
 * 版スキーマと単体ゲートが同じ条件を使うことで、結合前に薄い下書きを止める。
 */
export function collectArticleQualityErrors(article: ArticleQualityArticle, editionDate: string): ArticleQualityError[] {
  // 公開済みの2026-11-01〜26版を再検証で壊さず、失敗が判明した日から新規生成へ適用する。
  if (editionDate < '2026-11-27') return [];

  const errors: ArticleQualityError[] = [];
  const frameFields: Array<[string, string]> = [
    ...article.summary.map((text, index) => [`summary.${index}`, text] as [string, string]),
    ['comment', article.comment],
    ['attentionAnalysis.whyNotable', article.attentionAnalysis?.whyNotable ?? ''],
  ];
  for (const [field, text] of frameFields) {
    const matched = forbiddenArticleMetaFrames.find((frame) => text.includes(frame));
    if (matched) errors.push({ field, message: `記事自体を説明する定型フレームを使用できません: ${matched}` });
  }
  if (!article.attentionAnalysis) errors.push({ field: 'attentionAnalysis', message: '注目理由が必要です' });

  if (!article.articleDetail) {
    errors.push({ field: 'articleDetail', message: '方針v2では構造化した詳しい解説が必要です' });
    return errors;
  }
  const detail = article.articleDetail;
  if (detail.facts.length < 2) errors.push({ field: 'articleDetail.facts', message: 'factsは出来事を表す2件以上の具体的事実が必要です' });
  detail.facts.forEach((fact, index) => {
    if (isSourceTitleOnlyFact(fact, article.title)) {
      errors.push({ field: `articleDetail.facts.${index}`, message: 'factsに出典見出しそのものを置けません。資料中の出来事または数値を書いてください' });
    }
  });
  if (detail.explanation.length < 1) errors.push({ field: 'articleDetail.explanation', message: 'explanationは仕組みまたは因果を1件以上必要です' });
  if (detail.implications.length < 1) errors.push({ field: 'articleDetail.implications', message: 'implicationsは影響を1件以上必要です' });
  if (detail.nextChecks.length < 1) errors.push({ field: 'articleDetail.nextChecks', message: 'nextChecksは判断を更新する確認点を1件以上必要です' });
  return errors;
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
