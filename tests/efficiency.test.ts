import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFeed } from '../scripts/collect-candidate-ledger';

describe('日次処理のコンテキスト効率', () => {
  it('実行プロンプトを高密度に保ち、重い処理をスクリプトへ委譲する', () => {
    const prompt = readFileSync(resolve('automation/daily-news-digest.prompt.md'), 'utf8');
    expect(Buffer.byteLength(prompt)).toBeLessThan(25_000);
    expect(prompt).toContain('npm run candidates:collect');
    expect(prompt).toContain('npm run media:audit-bundle');
    expect(prompt).toContain('npm run check:all');
    expect(prompt).toContain('同じ日付のレビュー本文がローカルにあれば、Issueへ転載された同一本文を再読しない');
    expect(prompt).toContain('すべての専門ルールを毎回読み込まない');
    expect(prompt).toContain('警告と注釈も確認する');
    expect(prompt).toContain('全ツール定義を表示しない');
    expect(prompt).toContain('合計10件だけを最終JSONへ書き');
    expect(prompt).toContain('生成スクリプトで作ってはいけない');
    expect(prompt).toContain('model: "gpt-6-sol"');
    expect(prompt).toContain('主担当で使えるモデル名とサブエージェントへ指定できるモデル名は別');
    expect(prompt).toContain('未完成バッチや定型生成物へ監査を消費しない');
    expect(prompt).toContain('新しい完成候補に限り');
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
    const rss = '<?xml version="1.0"?><rss><channel><item><title><![CDATA[Security update &amp; fix]]></title><link>https://example.com/fix</link><pubDate>Wed, 05 Nov 2026 00:00:00 GMT</pubDate></item></channel></rss>';
    expect(parseFeed('rss', rss, 'feed', 'Feed')).toEqual([expect.objectContaining({
      title: 'Security update & fix', url: 'https://example.com/fix',
    })]);
  });
});
