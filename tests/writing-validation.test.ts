import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectSingleArticleGateErrors } from '../scripts/title-body-guard';
import { collectAnchorContentErrors } from '../src/lib/anchor-validation';

const healthyArticle = () => JSON.parse(readFileSync('data/daily/2026-11-14.json', 'utf8')).articles[0];

describe('記事単体の内容充足ゲート', () => {
  it('実物の定型メタフレームを止め、一般的な注意表現は止めない', () => {
    const article = healthyArticle();
    article.summary[1] = 'この件に関する掲載内容を、見出しだけで広げずに整理した。'.padEnd(90, '具体的な対象と日付を確認する。');
    article.comment = `${article.comment} 今回の確認という一点から、実際に確認すべき対象と未公表事項を分ける。`;
    article.attentionAnalysis.whyNotable = '利用者が、対応条件を確認するという判断材料にある。';
    const errors = collectSingleArticleGateErrors(article, '2026-11-27');
    expect(errors.join('\n')).toContain('定型フレーム');

    const ordinary = healthyArticle();
    ordinary.comment = `${ordinary.comment} 対象範囲と未確定事項は区別して扱う必要がある。`;
    expect(collectSingleArticleGateErrors(ordinary, '2026-11-27')).toEqual([]);
  });

  it('見出しコピー1件と空の詳細欄を止め、具体的な構造を通す', () => {
    const thin = healthyArticle();
    thin.articleDetail.facts = [thin.title];
    thin.articleDetail.implications = [];
    thin.articleDetail.nextChecks = [];
    const errors = collectSingleArticleGateErrors(thin, '2026-11-27').join('\n');
    expect(errors).toContain('factsは出来事を表す2件以上');
    expect(errors).toContain('出典見出しそのもの');
    expect(errors).toContain('implicationsは影響を1件以上');
    expect(errors).toContain('nextChecksは判断を更新する確認点を1件以上');
    expect(collectSingleArticleGateErrors(healthyArticle(), '2026-11-27')).toEqual([]);
  });
});

describe('アンカー内容ゲート', () => {
  it('薄い実物形状を止め、追加キーを持つ具体的な一次資料素材を通す', () => {
    const article = healthyArticle();
    const thin = {
      sourceUrl: article.sourceUrl,
      facts: [article.title],
      mechanism: '公開ページの題名と要約から確認できる範囲に限定する。',
      impact: '対象の利用者に影響し得る。',
      unknowns: '詳細は追加発表待ち。',
    };
    expect(collectAnchorContentErrors(thin, article, '2026-11-27').join('\n')).toContain('手順文の定型句');

    const concrete = {
      sourceUrl: article.sourceUrl,
      sources: [article.sourceUrl],
      facts: [
        'CryptoBilisで2026年8月から9月に購入されたSafe 5が調査対象とされた。',
        'メーカーは確認済みインプラントの取得機能を止める更新を11月11日に公開した。',
      ],
      mechanism: '端末が取得した情報を暗号化し、携帯通信網経由で攻撃者側のサーバーへ送る設計だった。',
      impact: '対象購入者は購入記録を照合し、新しいシードのウォレットへ資金を移す案内の対象になる。',
      unknowns: '他の販売店やモデルに追加の確認例があるか、支援対象の最終範囲は今後の発表で確定する。',
    };
    expect(collectAnchorContentErrors(concrete, article, '2026-11-27')).toEqual([]);
  });
});
