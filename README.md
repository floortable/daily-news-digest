# Daily News Digest

日本語ニュースダイジェストをGitHub Pagesで配信する、クライアント側暗号化対応のAstroプロジェクトです。記事はAES-256-GCMで暗号化され、パスフレーズを知る本人だけがブラウザー内で復号できます。

記事はブラウザー内のお気に入りに保存できます。登録すると記事データから自動構成した深掘りビューを表示します。外部AI APIは使用せず、お気に入り情報も外部へ送信しません。

GitHub Pagesと暗号化ファイルは公開されています。これはサーバー認証ではありません。十分に長いパスフレーズを使い、パスワードマネージャーで管理してください。パスフレーズは送信・保存されず、忘れた場合の再発行もできません。復号後は15分間操作がないと自動ロックします。

編集用データを復元する場合は `npm run decrypt:vault` を実行します。復元先はGit管理対象外の `private-data/daily` で、所有者だけが読めるファイル権限を設定します。

ソースコードは[MIT License](LICENSE)で公開します。ニュース記事・画像など第三者コンテンツにこのライセンスは適用されません。収集、要約、引用、削除対応は[編集・権利ポリシー](docs/editorial-policy.md)に従います。

記事は国や地域を優先条件にせず、内容の面白さ、重要性、話題性、分野の広がりで選びます。Hacker News、はてなブックマーク、Reddit、4chan、Togetter、GIGAZINE、一般報道・一次情報を並行して確認します。ソーシャル投稿は話題発見に使い、事実の根拠にはしません。件数配分、分野上限、Top 5の多様性は[記事選定ポリシー](docs/selection-policy.md)に従います。

## 必須の費用方針

このプロジェクトは追加課金なしで運用します。使用できる基盤は、GitHub Freeの公開リポジトリ、GitHub Pages、標準GitHub Actionsランナーのみです。有料プラン、有料API、有料・セルフホストランナー、独自ドメインへ自動的に切り替えてはいけません。

`npm run check:free-tier` はworkflowが `ubuntu-latest` だけを使用し、外部secretや代表的な課金AI API設定を参照していないことを検査します。この検査は費用発生を完全に判定するものではないため、新しい外部サービスの追加時は[無料運用ポリシー](docs/free-operation.md)も確認してください。

## セットアップ

Node.js 24とnpmを使用します。

```sh
npm ci
npm run check:free-tier
npm run check:licenses
npm run check:encrypted
npm run check:public-safety
npm test
npm run build
npm run dev
```

開発サーバーは通常 `http://localhost:4321` で起動します。

## 毎日の手動更新

1. Hacker News、はてなブックマーク、Reddit、4chan、Lobsters、Togetter、GIGAZINE、一般報道・一次情報から並行して候補を集める。
2. `docs/selection-policy.md` の件数配分、分野上限、媒体上限を確認し、30記事とTop 5を選ぶ。
3. Git管理対象外の `private-data/daily/YYYY-MM-DD.json` を、検証済みの収集結果を基に作成する。平文をリポジトリへ追加しない。
4. すべてのURLが記事個別ページであることを確認し、確認結果を `urlCheck` に記録する。
5. 合計140文字以上・2〜3段落の独自要約、180文字以上の独自解説、独自見出し、引用・画像の権利情報を記録し、日次の権利確認項目を完了する。
6. `npm run validate:data` で平文データを検証し、`npm run encrypt:vault` を実行して非表示入力でパスフレーズを2回入力する。
7. `public/private/vault.json` だけを更新対象とし、`npm run check:encrypted`、`npm test`、`npm run build` を実行する。
8. 暗号化ファイルと選定バランスをレビューし、mainへ反映する。CI成功後にPagesが公開される。

不正なデータではビルドが失敗します。生成失敗時に前日のデータを当日分としてコピーしないでください。

## データ仕様

実行時の正規スキーマは `src/lib/schema.ts` です。平文データは無視対象の `private-data/` にだけ置きます。公開リポジトリには、PBKDF2-SHA-256（60万回）で鍵導出し、gzip圧縮後にAES-256-GCMで暗号化した `public/private/vault.json` だけを保存します。

## RSS

RSSには安全なパスフレーズ認証を組み込めないため停止しています。フィードを公開すると記事内容が漏れるため、暗号化運用中は再追加しません。

## GitHub Pages

Repository Settings → Pages → SourceをGitHub Actionsに設定してください。`main`へのpushでCIとデプロイが実行されます。ワークフローはcontentsをread、Pagesデプロイだけをpages/writeとid-token/writeに限定しています。

## 自動化方針

現時点の調査、費用、制約、推奨構成は [docs/architecture.md](docs/architecture.md) を参照してください。ChatGPT PlusとOpenAI API課金は別扱いです。既存のChatGPTニュースタスクは新方式の確認前に停止しないでください。

## 復旧

- データエラー: `private-data/daily` の平文JSONを修正し、再暗号化する。
- パスフレーズ紛失: 復号・再発行はできない。手元の平文バックアップから新しいパスフレーズで保管庫を再作成する。
- ビルドエラー: Node.js 24で `npm ci && npm run build` を再現する。
- 公開エラー: ActionsのCIが成功していること、PagesのSourceがGitHub Actionsであることを確認する。
- 誤った版: 暗号化ファイルをrevertする。前日の記事を当日分として複製しない。
