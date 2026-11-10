import { describe, expect, it } from 'vitest';
import type { Edition } from '../src/lib/schema';
import {
  collectNarrationStyleErrors,
  collectTitleQualityErrors,
} from '../scripts/editorial-quality-validation';

function qualityFixture(date = '2026-11-11'): Edition {
  return {
    date,
    articles: [{
      id: `${date}-sample`,
      title: '固有の出来事を示す見出し',
      narration: {
        result: 'この結果は利用者に影響します。',
        detail: ['提供元は対象範囲を公表しました。'],
        learning: ['導入前に互換性を確認できます。'],
        analysis: ['更新時期を確認する必要があります。'],
        anticipatedQuestions: [{ answer: '公式資料の更新を待つのが適切です。' }],
      },
      attentionAnalysis: { currentReaction: '利用者からは慎重な反応が出ています。' },
    }],
  } as Edition;
}

describe('新工程の決定的な編集品質ゲート', () => {
  it('2026-11-11以降では完全一致の仮置き見出しと重複見出しを拒否する', () => {
    const edition = qualityFixture();
    edition.articles[0].title = '本日の更新';
    edition.articles.push({ ...structuredClone(edition.articles[0]), id: '2026-11-11-other', title: '本日の更新' });
    const errors = collectTitleQualityErrors(edition);
    expect(errors).toHaveLength(3);
    expect(errors.some((error) => error.includes('仮置き見出し'))).toBe(true);
    expect(errors.some((error) => error.includes('重複しています'))).toBe(true);
  });

  it('出来事を後ろに補った見出しは仮置きとして誤検出しない', () => {
    const edition = qualityFixture();
    edition.articles[0].title = '本日の更新：Metaが新モデルを発表';
    expect(collectTitleQualityErrors(edition)).toEqual([]);
  });

  it('既存版の期間には新しい見出し・常体ゲートを適用しない', () => {
    const edition = qualityFixture('2026-11-10');
    edition.articles[0].title = '本日の更新';
    edition.articles[0].narration!.result = '結果を公表した。';
    expect(collectTitleQualityErrors(edition)).toEqual([]);
    expect(collectNarrationStyleErrors(edition)).toEqual([]);
  });

  it('常体、単独のいいえ、反応欄のコメントを検出し、引用中の常体は誤検出しない', () => {
    const edition = qualityFixture();
    edition.articles[0].narration!.result = '提供元は「仕様は未確定だ」と説明しました。';
    edition.articles[0].narration!.detail = ['利用開始日は未定である。'];
    edition.articles[0].narration!.anticipatedQuestions = [{ question: '利用者は事前に準備する？', answer: 'いいえ。追加の確認が必要です。' }];
    edition.articles[0].attentionAnalysis.currentReaction = '開発者からコメント。';
    const errors = collectNarrationStyleErrors(edition);
    expect(errors).toHaveLength(4);
    expect(errors.join('\n')).not.toContain('仕様は未確定だ');
    expect(errors.join('\n')).toContain('narration.detail[0]');
    expect(errors.join('\n')).toContain('anticipatedQuestions[0].question');
    expect(errors.join('\n')).toContain('anticipatedQuestions[0].answer');
    expect(errors.join('\n')).toContain('attentionAnalysis.currentReaction');
  });
});
