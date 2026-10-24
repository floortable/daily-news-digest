# Security Policy

## Reporting

秘密情報、個人情報、XSS、依存関係などの問題は、公開Issueに詳細を書かず、GitHubのPrivate vulnerability reportingから報告してください。

## Public repository rules

- `.env`、資格情報、個人情報、非公開URLをcommitしない。
- 記事本文は信頼できない外部入力として扱い、HTMLとして直接挿入しない。
- 外部Action、外部Secret、有料APIをworkflowへ追加しない。
- Public化またはpushの前に `npm run check:public-safety` を実行する。
- 検査で問題が出た場合は、値を単に削除するだけでなくGit履歴への残存も確認する。
