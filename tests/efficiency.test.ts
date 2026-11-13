import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFeed } from '../scripts/collect-candidate-ledger';

describe('日次処理のコンテキスト効率', () => {
  it('実行プロンプトを高密度に保ち、重い処理をスクリプトへ委譲する', () => {
    const promptFiles = [
      'automation/daily-news-digest.prompt.md',
      'automation/rules/selection.md',
      'automation/rules/writing.md',
      'automation/rules/narration.md',
      'automation/rules/review-publish.md',
    ];
    const prompt = promptFiles.map((file) => readFileSync(resolve(file), 'utf8')).join('\n');
    expect(Buffer.byteLength(readFileSync(resolve(promptFiles[0])))).toBeLessThanOrEqual(10_000);
    for (const file of promptFiles.slice(1)) {
      expect(Buffer.byteLength(readFileSync(resolve(file)))).toBeLessThanOrEqual(12_000);
    }
    expect(Buffer.byteLength(prompt)).toBeLessThanOrEqual(40_000);
    expect(prompt).toContain('npm run candidates:collect');
    expect(prompt).toContain('npm run media:audit-bundle');
    expect(prompt).toContain('npm run check:all');
    expect(prompt).toContain('レビューの入力はVM生成の`reviews/`だけ');
    expect(prompt).toContain('すべての専門ルールを毎回読み込まない');
    expect(prompt).toContain('警告と注釈も確認する');
    expect(prompt).toContain('全ツール定義を表示しない');
    expect(prompt).toContain('採用記事は必ず1件ずつ完結させる');
    expect(prompt).toContain('生成スクリプトで作ってはいけない');
    expect(prompt).toContain('model: "gpt-6-sol"');
    expect(prompt).toContain('主担当で使えるモデル名とサブエージェントへ指定できるモデル名は別');
    expect(prompt).toContain('対象記事の台帳行、一次資料、アンカーだけを');
    expect(prompt).toContain('版全体レビューを再依頼しない');
    expect(prompt).toContain('版全体の事実確認不能へ拡大してはいけません');
    expect(prompt).toContain('代替経路を1巡→候補差し替え→記事数を18件、なお必要なら15件まで縮小');
    expect(prompt).toContain('403の件数や取得不能な媒体名だけでは停止根拠になりません');
    expect(prompt).toContain('これらを試さず「十分に裏付けられない」「品質を下げたくない」と総括して終了してはいけません');
  });

  it('低頻度の保守調査を日次生成から分離する', () => {
    const prompt = readFileSync(resolve('automation/monthly-maintenance.prompt.md'), 'utf8');
    expect(Buffer.byteLength(prompt)).toBeLessThan(10_000);
    expect(prompt).toContain('キャッシュ率だけで効率を判断せず');
    expect(prompt).toContain('要対応');
    expect(prompt).toContain('期限まで監視');
    expect(prompt).toContain('情報のみ');
    expect(prompt).toContain('ニュース記事や音声は生成しない');
  });

  it('Hacker NewsのJSONを候補台帳へ正規化する', () => {
    const candidates = parseFeed('hn-algolia', JSON.stringify({ hits: [{
      objectID: '123', title: 'A useful project', url: 'https://example.com/project',
      created_at: '2026-11-05T00:00:00Z', points: 42, num_comments: 7,
    }] }), 'hn', 'Hacker News');
    expect(candidates).toEqual([expect.objectContaining({
      sourceId: 'hn', title: 'A useful project', url: 'https://example.com/project',
      discoveryUrl: 'https://news.ycombinator.com/item?id=123',
      observedMetric: '42 points / 7 comments',
    })]);
  });

  it('候補設定に全体上限と媒体別上限を要求する', () => {
    const config = JSON.parse(readFileSync(resolve('config/candidate-feeds.json'), 'utf8'));
    expect(config.maxCandidates).toBeLessThanOrEqual(45);
    expect(config.feeds.every((feed: { maxCandidates?: number }) =>
      typeof feed.maxCandidates === 'number' && feed.maxCandidates <= 20)).toBe(true);
  });

  it('Hacker News候補は対象期間をAPIへ渡せる設定を使う', () => {
    const config = JSON.parse(readFileSync(resolve('config/candidate-feeds.json'), 'utf8'));
    const hackerNews = config.feeds.find((feed: { adapter: string }) => feed.adapter === 'hn-algolia');
    expect(hackerNews.url).toContain('hn.algolia.com/api/v1/search_by_date');
    expect(hackerNews.maxCandidates).toBeLessThanOrEqual(20);
  });

  it('RSSとAtomの代表的な形式を候補台帳へ正規化する', () => {
    const rss = '<?xml version="1.0"?><rss><channel><item><title><![CDATA[Security update &amp; fix]]></title><link>https://example.com/fix</link><description><![CDATA[Vendor advisory with affected versions and remediation.]]></description><pubDate>Wed, 05 Nov 2026 00:00:00 GMT</pubDate></item></channel></rss>';
    expect(parseFeed('rss', rss, 'feed', 'Feed')).toEqual([expect.objectContaining({
      title: 'Security update & fix', url: 'https://example.com/fix',
      sourceSummary: 'Vendor advisory with affected versions and remediation.',
    })]);
  });

  it('候補要約をコンテキスト保護のため1000文字へ制限する', () => {
    const rss = `<?xml version="1.0"?><rss><channel><item><title>Long report</title><link>https://example.com/long</link><description>${'x'.repeat(1_500)}</description></item></channel></rss>`;
    const [candidate] = parseFeed('rss', rss, 'feed', 'Feed');
    expect(candidate.sourceSummary).toHaveLength(1_000);
  });
});
