# 自動化の構成と制約

更新日: 2026-10-25

## 結論

現在は「Mac上のCodexローカル定期実行が調査、JSON作成、検証、commit、pushを行い、GitHub Actionsが再検証してGitHub Pagesへ公開する」構成とする。ニュース生成は `data/daily/YYYY-MM-DD.json` の契約から分離し、公開可能な処理仕様はGitHub、端末固有の実行状態と認証情報はMac内で管理する。

追加課金なしを必須条件とし、有料API、有料ランナー、独自ドメインは採用しない。ChatGPT/Codexの契約をOpenAI APIの無人実行に転用できるとは扱わず、APIキーや課金APIを導入しない。完全クラウド化は、定期起動、リポジトリ編集、品質を満たす生成、無人pushを追加課金なしで同時に満たせないため採用しない。

## 選択肢と制約

| 方法 | 毎朝実行 | 無人GitHub push | Mac常時起動 | 追加費用・承認 | 判定 |
| --- | --- | --- | --- | --- | --- |
| ChatGPT Tasks | ChatGPT内の定期実行は可能 | Tasksの出力を任意リポジトリへ直接commitする、一般提供された書込み契約は確認できない | 不要 | 有料プラン依存なら本プロジェクトの自動化には不採用 | 直接push前提にしない |
| ChatGPT接続アプリ | GitHub情報の参照用途とは別に、定期タスクからの無人書込みを保証する公開仕様を確認できない | 未確認 | 不要 | 書込み時の承認・権限モデルをUIで要確認 | 実装しない |
| Codexローカル自動化 | 可能 | ローカルGit認証で可能 | Macの起動とCodex稼働が必要 | ChatGPT/Codex契約枠内 | **現在採用** |
| Codexクラウド環境 | タスク単位の実行は可能 | タスク中は可能 | 不要 | 定期的に自身を起動する機能がない | 定期実行には不採用 |
| GitHub Actions + OpenAI API | cron実行とpushが可能 | `GITHUB_TOKEN` で可能 | 不要 | OpenAI APIは別課金 | 採用禁止 |
| GitHub Actions + 無料AI API | サービス次第で可能 | 可能 | 不要 | 無料枠、保存方針、突然の制限変更リスク | 将来の任意アダプター |

## 推奨アーキテクチャ

1. 収集器がHacker News、はてなブックマーク、Reddit、4chan、Lobsters、Togetter、GIGAZINE、一般報道・一次情報を地域による優先順位を付けずに確認し、URL、公開日時、対象地域、人気指標などの事実メタデータを取得する。ソーシャル投稿は発見入力として隔離し、事実の出典として扱わない。
2. URL正規化と重複排除を行い、本文は信頼できない入力として扱う。
3. 選定器が `docs/selection-policy.md` に基づき、発見経路、分野、媒体、専門内外、硬軟の偏りを検査し、件数を固定せず一般ニュースを30件前後選ぶ。
4. 生成器が候補メタデータを受け取り、日本語要約とTop 5候補を返す。生成器にGitHub資格情報を渡さない。
5. 検証器がSchema、ID・URL重複、日付、Top 5順位、個別URL確認結果に加え、選定ポリシーへの適合を検査する。
6. publisherだけが最小権限でJSONをcommitする。
7. push後のCIが同じ検証を再実行し、成功した場合だけ静的サイトを公開する。

失敗時は新しい日付のファイルを作らない。前日の版を当日の日付にコピーしない。既存公開版はそのまま維持する。

## 現在の責任分界

- GitHub: 公開可能な指示、選定・権利ポリシー、Schema、検証、サイト、日次データ、CI、Pages設定を管理する。
- Mac: 自動化ID、対象Chat ID、絶対パス、認証情報、Cookie、実行状態、端末固有ログを管理する。
- Codexローカル定期実行: 毎朝8時（Asia/Tokyo）にGitHub上の正本と同じ指示で処理する。
- GitHub Actions: push済み内容だけを再検証し、成功した場合にPagesへ公開する。ニュース生成や外部AI API呼び出しは行わない。

詳細な復元・同期手順は [automation-operations.md](automation-operations.md) を参照する。

参考にした公式情報の入口:

- OpenAI Help: <https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt>
- OpenAI API pricing: <https://openai.com/api/pricing/>
- Codex: <https://developers.openai.com/codex/>
- GitHub Pages: <https://docs.github.com/pages>
- GitHub Actions billing: <https://docs.github.com/billing/managing-billing-for-your-products/managing-billing-for-github-actions>
- `GITHUB_TOKEN` permissions: <https://docs.github.com/actions/security-for-github-actions/security-guides/automatic-token-authentication>
