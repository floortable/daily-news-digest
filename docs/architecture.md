# 自動化の調査結果と推奨構成

調査日: 2026-10-24

## 結論

初期版は「検証済みJSONをGitへ保存すると、GitHub Actionsが検証・ビルド・GitHub Pages公開を行う」構成とする。ニュース生成は `data/daily/YYYY-MM-DD.json` の契約から分離し、手動、ChatGPT、将来の収集ジョブのどれでも交換できる。

追加課金なしを必須条件とし、有料プラン、有料API、有料ランナー、独自ドメインは採用しない。ChatGPT Plusの契約をOpenAI APIの無人実行に転用できるとは扱わず、APIキーや課金APIを導入しない。当面は人が検証したJSONを投入する経路を正とする。無料で継続利用できる契約を確認できない機能は実装せず、制約として報告する。

## 選択肢と制約

| 方法 | 毎朝実行 | 無人GitHub push | Mac常時起動 | 追加費用・承認 | 判定 |
| --- | --- | --- | --- | --- | --- |
| ChatGPT Tasks | ChatGPT内の定期実行は可能 | Tasksの出力を任意リポジトリへ直接commitする、一般提供された書込み契約は確認できない | 不要 | 有料プラン依存なら本プロジェクトの自動化には不採用 | 直接push前提にしない |
| ChatGPT接続アプリ | GitHub情報の参照用途とは別に、定期タスクからの無人書込みを保証する公開仕様を確認できない | 未確認 | 不要 | 書込み時の承認・権限モデルをUIで要確認 | 実装しない |
| Codexローカル自動化 | 製品の自動化機能が利用可能ならスケジュール可能 | Git認証とpush権限が必要 | ローカル実行型はMacの起動とCodex稼働が必要 | push承認・実行環境を要確認 | 常時運用の第一候補にしない |
| Codexクラウド環境 | タスク実行中の開発・Git操作は可能 | スケジュール起動、恒久資格情報、無人pushが製品設定で保証されるか要確認 | 不要 | プラン上限と各操作の承認条件を要確認 | 契約を確認できるまで手動運用 |
| GitHub Actions + OpenAI API | cron実行とpushが可能 | `GITHUB_TOKEN` で可能 | 不要 | OpenAI APIは別課金 | 採用禁止 |
| GitHub Actions + 無料AI API | サービス次第で可能 | 可能 | 不要 | 無料枠、保存方針、突然の制限変更リスク | 将来の任意アダプター |

## 推奨アーキテクチャ

1. 収集器がHacker News、Reddit、4chan、Lobsters、海外報道・一次情報を優先し、はてなブックマーク、Togetter、GIGAZINEなど日本語圏の入口で補完しながら、URL、公開日時、対象地域、人気指標などの事実メタデータを取得する。ソーシャル投稿は発見入力として隔離し、事実の出典として扱わない。
2. URL正規化と重複排除を行い、本文は信頼できない入力として扱う。
3. 選定器が `docs/selection-policy.md` に基づき、発見経路、分野、媒体、専門内外、硬軟の偏りを検査して30記事を選ぶ。
4. 生成器が候補メタデータを受け取り、日本語要約とTop 5候補を返す。生成器にGitHub資格情報を渡さない。
5. 検証器がSchema、ID・URL重複、日付、Top 5順位、個別URL確認結果に加え、選定ポリシーへの適合を検査する。
6. publisherだけが最小権限でJSONをcommitする。
7. push後のCIが同じ検証を再実行し、成功した場合だけ静的サイトを公開する。

失敗時は新しい日付のファイルを作らない。前日の版を当日の日付にコピーしない。既存公開版はそのまま維持する。

## 実運用前に確認する項目

- ChatGPTの現在のタスク編集画面で、GitHub書込みアクションと無人実行時の承認条件が明示されているか。
- Codexの現在の自動化画面で、クラウド実行かローカル実行か、端末スリープ時の挙動、push承認を確認する。
- GitHub PagesをActionsソースに設定し、リポジトリのActions利用上限と公開範囲を確認する。
- API方式を採る場合だけ、料金上限と予算アラートを先に設定する。

参考にした公式情報の入口（この環境では各ページがHTTP 403を返したため、公開内容の再確認が必要）:

- OpenAI Help: <https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt>
- OpenAI API pricing: <https://openai.com/api/pricing/>
- Codex: <https://developers.openai.com/codex/>
- GitHub Pages: <https://docs.github.com/pages>
- GitHub Actions billing: <https://docs.github.com/billing/managing-billing-for-your-products/managing-billing-for-github-actions>
- `GITHUB_TOKEN` permissions: <https://docs.github.com/actions/security-for-github-actions/security-guides/automatic-token-authentication>
