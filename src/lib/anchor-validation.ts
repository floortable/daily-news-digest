import { z } from 'zod';
import { isSourceTitleOnlyFact } from './writing-validation';

const anchorSchema = z.object({
  sourceUrl: z.string().url(),
  facts: z.array(z.string()),
  mechanism: z.string(),
  impact: z.string(),
  unknowns: z.string(),
});

const forbiddenAnchorProcedureFrames = [
  '題名と要約から確認できる範囲に限定',
] as const;

export interface AnchorArticleReference {
  id: string;
  title: string;
  sourceUrl: string;
}

/** 日付ゲート後の根拠メモを検証する。過去版の再結合は変更しない。 */
export function collectAnchorContentErrors(
  raw: unknown,
  article: AnchorArticleReference,
  editionDate: string,
): string[] {
  if (editionDate < '2026-11-27') return [];
  const parsed = anchorSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues.map((issue) => `アンカー形式が不正です: ${issue.path.join('.') || 'root'} ${issue.message}`);

  const anchor = parsed.data;
  const errors: string[] = [];
  if (anchor.sourceUrl !== article.sourceUrl) errors.push('sourceUrlが記事のsourceUrlと一致しません');
  if (anchor.facts.length < 2) errors.push('factsは出来事を表す2件以上の文字列が必要です');
  anchor.facts.forEach((fact, index) => {
    if (isSourceTitleOnlyFact(fact, article.title)) errors.push(`facts.${index}に出典見出しそのものを置けません`);
  });
  for (const [field, value] of Object.entries({ mechanism: anchor.mechanism, impact: anchor.impact, unknowns: anchor.unknowns })) {
    if (value.length < 20) errors.push(`${field}は20文字以上必要です`);
    const matched = forbiddenAnchorProcedureFrames.find((frame) => value.includes(frame));
    if (matched) errors.push(`${field}に手順文の定型句を置けません: ${matched}`);
  }
  return errors;
}
