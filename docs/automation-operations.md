# Codexローカル定期実行の運用

## 正本

公開可能な自動化仕様はGitHubを正本とする。

- 完全な処理指示: `automation/daily-news-digest.prompt.md`
- 実行方式と時刻: `automation/manifest.json`
- 選定基準: `docs/selection-policy.md`
- 権利・引用基準: `docs/editorial-policy.md`
- 無料運用: `docs/free-operation.md`

Codexアプリ内の定期実行プロンプトを変更する場合は、先に正本を変更して検証・commitし、その内容をローカル定期実行へ同期する。アプリ内だけで恒久的な仕様変更を行わない。

## GitHubで管理する情報

- 自動化の目的、完全な処理手順、選定基準、失敗条件
- 毎朝8時、Asia/Tokyoというスケジュールの意味
- ローカル実行であることと、MacおよびCodexの稼働が必要なこと
- 必須検証コマンド、commit・push・CI・Pages確認手順
- 使用禁止の有料API、追加課金サービス、権利上の禁止事項
- 復元手順と公開・非公開情報の境界

## Mac内だけで管理する情報

次はPublicリポジトリへcommitしない。

- リポジトリやCodex設定の絶対パス、macOSユーザー名、ホスト名
- Codexの自動化ID、対象Chat ID、内部セッションID、実行状態
- GitHubのtoken、資格情報、SSH秘密鍵、Cookie、ブラウザーセッション
- ローカルの承認設定、端末固有設定、未加工の実行ログや一時ファイル
- 公開前の候補メモに含まれる個人情報、アクセス制限された本文、削除済み投稿の複製

端末固有の復元メモはGit管理外の `private-data/automation.local.md` に置く。`private-data/` と `automation/*.local.*` は `.gitignore` 対象であり、公開安全性チェックも追跡を拒否する。

## 同期手順

1. GitHub側の正本とCodexアプリ内の指示を比較する。
2. 仕様変更は正本へ反映し、公開禁止情報がないことを確認する。
3. 全検証を実行して正本をmainへ反映する。
4. `automation/daily-news-digest.prompt.md` の内容をCodexローカル定期実行へ同期する。
5. 実行時刻が毎朝8時（Asia/Tokyo）、状態が有効、対象が正しいローカルリポジトリであることをMac側で確認する。
6. 自動化ID、Chat ID、絶対パス、確認日時だけを `private-data/automation.local.md` に記録する。

## 復元手順

1. PublicリポジトリをMacへcloneする。
2. Node.js 24で依存関係を導入し、全検証を通す。
3. Codexでローカル定期実行を作り、正本の指示を登録する。
4. 毎朝8時（Asia/Tokyo）を設定する。
5. GitHubへのpush権限をローカル資格情報として設定する。資格情報をリポジトリへ保存しない。
6. 手動試験でJSON作成、検証、commit、push、CI、Pages反映まで確認する。
7. 端末固有情報をGit管理外の復元メモへ記録する。

## 変更時の必須検証

```sh
npm run validate:data
npm test
npm run build
npm run check:free-tier
npm run check:licenses
npm run check:public-safety
```

一つでも失敗した場合はpushせず、既存公開版を維持する。
