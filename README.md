# Daily News Digest

個人的に関心のある分野のニュースを毎日まとめて確認するために作った、日本語ニュースダイジェストです。自分の端末から読みやすいよう、Astro製の静的サイトとRSSとして公開しています。

これは一般向けの網羅的なニュース媒体ではなく、個人の関心と選定基準に基づく情報収集・整理ツールです。速報性や完全性を目的とせず、掲載内容は独自の要約と解説です。事実関係や最新情報はリンク先の原文・公式情報を確認してください。日次データには、URL、公開日、権利条件を確認した実在ニュースだけを登録します。

記事はブラウザー内のお気に入りに保存できます。登録すると記事データから自動構成した深掘りビューを表示します。外部AI APIは使用せず、お気に入り情報も外部へ送信しません。

ソースコードは[MIT License](LICENSE)で公開します。ニュース記事・画像など第三者コンテンツにこのライセンスは適用されません。収集、要約、引用、削除対応は[編集・権利ポリシー](docs/editorial-policy.md)に従います。

動画・音声用のBGMにもMIT Licenseは適用されません。利用条件は[音源ライブラリの説明](assets/audio/bgm/README.md)に記載しています。

記事は個人的な関心を軸にしつつ、特定分野へ偏りすぎないよう、内容の面白さ、重要性、話題性、意外性、分野の広がりから選びます。Hacker News、はてなブックマーク、Reddit、4chan、Togetter、GIGAZINE、一般報道・一次情報を並行して確認します。ソーシャル投稿は話題発見に使い、事実の根拠にはしません。件数配分、分野上限、Top 5の多様性は[記事選定ポリシー](docs/selection-policy.md)に従います。

## 必須の費用方針

このプロジェクトは追加課金なしで運用します。使用できる基盤は、GitHub Freeの公開リポジトリ、GitHub Pages、標準GitHub Actionsランナーのみです。有料プラン、有料API、有料・セルフホストランナー、独自ドメインへ自動的に切り替えてはいけません。

`npm run check:free-tier` はworkflowが `ubuntu-latest` だけを使用し、外部secretや代表的な課金AI API設定を参照していないことを検査します。この検査は費用発生を完全に判定するものではないため、新しい外部サービスの追加時は[無料運用ポリシー](docs/free-operation.md)も確認してください。

## セットアップ

Node.js 24とnpmを使用します。

```sh
npm ci
npm run check:free-tier
npm run check:licenses
npm run check:public-safety
npm test
npm run build
npm run dev
```

開発サーバーは通常 `http://localhost:4321` で起動します。

## 毎日の手動更新

1. Hacker News、はてなブックマーク、Reddit、4chan、Lobsters、Togetter、GIGAZINE、一般報道・一次情報から並行して候補を集める。
2. `docs/selection-policy.md` の件数目安、分野上限、媒体上限を確認し、一般ニュースを30件前後（通常25〜35件程度）とTop 5、必要なVCF専門枠を選ぶ。件数合わせの水増しや機械的な削除は行わない。
3. `data/daily/YYYY-MM-DD.json` を既存ファイルからではなく、検証済みの収集結果を基に作成する。
4. すべてのURLが記事個別ページであることを確認し、確認結果を `urlCheck` に記録する。
5. 合計140文字以上・2〜3段落の独自要約、180文字以上の独自解説、独自見出し、引用・画像の権利情報を記録し、日次の権利確認項目を完了する。
6. `npm run validate:data`、`npm test`、`npm run build` を実行する。
7. JSONと選定バランスをレビューし、mainへ反映する。CI成功後にPagesが公開される。

不正なデータではビルドが失敗します。生成失敗時に前日のデータを当日分としてコピーしないでください。

## データ仕様

実行時の正規スキーマは `src/lib/schema.ts` です。日付ごとのJSONにはTop 5の順位1〜5、安定した記事ID、検証済みURL、出典、日時、カテゴリ、独自要約、コメント、情報種別を含めます。追跡パラメータ除去後のURL重複も検出します。

## 配信先

- `/rss.xml`: 全記事
- `/rss/top5.xml`: Top 5
- `/rss/vcf.xml`: VCF・VMware・競合

## Top 5読み上げ

VOICEVOXを起動した状態で、最新日のTop 5台本と3キャスターによる読み上げ音声を生成できます。

```sh
npm run media:script
npm run media:voicevox
npm run media:render
```

VOICEVOX Engineの既定URLは `http://127.0.0.1:50021` です。別のURLを使う場合は
`VOICEVOX_URL` を指定します。日付を固定する場合は、各コマンドの末尾に
`-- --date YYYY-MM-DD` を追加します。生成物は `generated/media/YYYY-MM-DD/` に保存され、
Gitには登録されません。キャスターと話速は `config/voicevox.json` で変更できます。
固有名詞の読みは `config/pronunciations.json` で調整します。`media:voicevox` は記事間ジングルを含む
48 kHz WAVを作り、`media:render` はテーマ別の候補から日ごとにBGMを選び、各トピックで切り替えて読み上げより21 dB下げて合成します。
約 -16 LUFSに正規化したAAC/M4A、BGMなしM4A、字幕トラックと記事カードを持つMP4が
`generated/media/YYYY-MM-DD/` に生成されます。BGM原本は公開先へコピーされません。

公開済みメディアだけをサイトと `/rss/audio.xml` に表示するため、配信ファイルを配置した日付を
`config/published-media.json` に追加します。ローカル生成だけでは追加しないでください。音声・動画には
VOICEVOXクレジットと、BGM・トピック切替SEの制作／利用権管理表記をメタデータ、字幕、サイト表示で付与します。

台本は各記事を「タイトル → 現在の反響を示す事実1文 → 結果を先に示す要約 → 内容と解説」の順に構成し、読み上げでは順位を付けません。
反響の事実だけで規模が伝わる場合は、「反響が大きい」「評価は妥当」などの重複した定型説明を加えません。
音声向けの追加解説は原文を再確認し、`narration.sourceCheckedAt` と `narration.detail` に記録します。
本文は書き言葉の「である」調を読み上げず、意味を保った自然な「です・ます」調に整えます。
ずんだもんの担当記事は、冒頭の反響説明と最後の解説に特徴的な語尾を使い、本文途中ではくどくならないよう抑えます。
解説の想定読者と深さは `config/narration-audience.json` に定めます。各記事では概要の言い換えだけで終わらず、
専門用語の定義、仕組みの具体像、重要性、未確定点、持ち帰れる判断軸を `narration.learning` に記録します。
台本の重複防止、記事内のキャスター交代、VOICEVOXとBGMの公開条件は
[Top 5 台本・音声・動画生成ルール](docs/media-production-policy.md)を必須ルールとします。

読み上げクレジット: VOICEVOX:満別花丸、VOICEVOX:ずんだもん、VOICEVOX:四国めたん

## GitHub Pages

Repository Settings → Pages → SourceをGitHub Actionsに設定してください。`main`へのpushでCIとデプロイが実行されます。ワークフローはcontentsをread、Pagesデプロイだけをpages/writeとid-token/writeに限定しています。

## 自動化方針

現時点の調査、費用、制約、推奨構成は [docs/architecture.md](docs/architecture.md) を参照してください。ChatGPT PlusとOpenAI API課金は別扱いです。既存のChatGPTニュースタスクは新方式の確認前に停止しないでください。

## 復旧

- データエラー: `npm run validate:data` のファイル名と項目を修正する。
- ビルドエラー: Node.js 24で `npm ci && npm run build` を再現する。
- 公開エラー: ActionsのCIが成功していること、PagesのSourceがGitHub Actionsであることを確認する。
- 誤った版: Git履歴で該当JSONの変更をrevertする。過去の正しい版を別日として複製しない。
