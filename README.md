# Daily News Digest

日本語ニュースダイジェストを静的サイトとRSSで公開するAstroプロジェクトです。現在のデータはUI検証用の架空サンプルで、実ニュースではありません。

## 必須の費用方針

このプロジェクトは追加課金なしで運用します。使用できる基盤は、GitHub Freeの公開リポジトリ、GitHub Pages、標準GitHub Actionsランナーのみです。有料プラン、有料API、有料・セルフホストランナー、独自ドメインへ自動的に切り替えてはいけません。

`npm run check:free-tier` はworkflowが `ubuntu-latest` だけを使用し、外部secretや代表的な課金AI API設定を参照していないことを検査します。この検査は費用発生を完全に判定するものではないため、新しい外部サービスの追加時は[無料運用ポリシー](docs/free-operation.md)も確認してください。

## セットアップ

Node.js 24とnpmを使用します。

```sh
npm ci
npm run check:free-tier
npm test
npm run build
npm run dev
```

開発サーバーは通常 `http://localhost:4321` で起動します。

## 毎日の手動更新

1. `data/daily/YYYY-MM-DD.json` を既存ファイルからではなく、検証済みの収集結果を基に作成する。
2. すべてのURLが記事個別ページであることを確認し、確認結果を `urlCheck` に記録する。
3. `npm run validate:data`、`npm test`、`npm run build` を実行する。
4. JSONだけをレビューし、mainへ反映する。CI成功後にPagesが公開される。

不正なデータではビルドが失敗します。生成失敗時に前日のデータを当日分としてコピーしないでください。

## データ仕様

実行時の正規スキーマは `src/lib/schema.ts` です。日付ごとのJSONにはTop 5の順位1〜5、安定した記事ID、検証済みURL、出典、日時、カテゴリ、独自要約、コメント、情報種別を含めます。追跡パラメータ除去後のURL重複も検出します。

## 配信先

- `/rss.xml`: 全記事
- `/rss/top5.xml`: Top 5
- `/rss/vcf.xml`: VCF・VMware・競合

## GitHub Pages

Repository Settings → Pages → SourceをGitHub Actionsに設定してください。`main`へのpushでCIとデプロイが実行されます。ワークフローはcontentsをread、Pagesデプロイだけをpages/writeとid-token/writeに限定しています。

## 自動化方針

現時点の調査、費用、制約、推奨構成は [docs/architecture.md](docs/architecture.md) を参照してください。ChatGPT PlusとOpenAI API課金は別扱いです。既存のChatGPTニュースタスクは新方式の確認前に停止しないでください。

## 復旧

- データエラー: `npm run validate:data` のファイル名と項目を修正する。
- ビルドエラー: Node.js 24で `npm ci && npm run build` を再現する。
- 公開エラー: ActionsのCIが成功していること、PagesのSourceがGitHub Actionsであることを確認する。
- 誤った版: Git履歴で該当JSONの変更をrevertする。過去の正しい版を別日として複製しない。
