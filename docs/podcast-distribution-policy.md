# Podcast配信ルール

最終確認日: 2026-10-27

## 番組の位置付け

- 毎日のTop 5を入口に、周辺知識、産業や社会の構造、日本への波及、今後を見る判断軸を届ける、エンジニア向けの短い教養Podcastとする。
- 中心ペルソナは、ソフトウェア、インフラ、AI、セキュリティの基礎を理解し、専門外の領域も構造と具体例から学びたい個人エンジニアとする。初心者向けの用語集にも、専門家だけに通じる論文読み上げにも寄せない。
- ニュース本文の朗読や要約集ではなく、複数の一次資料と信頼できる報道を基にした独自の構成・解説にする。
- 1話5トピックを基本とし、各トピックは「結論」「背景と仕組み」「追加視点と見通し」の順にする。長さを揃えるために薄い解説を足さない。
- ショーノートには取り上げた記事、追加資料、訂正履歴、VOICEVOXとBGM・SEのクレジットを載せる。

## 語り口

- 聞き手の知識を尊重し、「範囲外書きとは」のような教科書的な定義から始めない。「確保した領域の外へ書く、よくある範囲外書きが今回は認証前の入力処理で起きます」のように、既知の概念を短く確認してニュース固有の意味へ進む。
- 「当然ですが」「ご存じでしょうが」「エンジニアなら分かるように」のように知識を試す言い方はしない。「いわゆる」「ここでは」「今回厄介なのは」など、前提を自然に共有する接続を使う。
- 初歩説明を削った分、発生条件、データフロー、信頼境界、失敗時の挙動、影響を受ける構成、回避策の副作用など、実務に使える差分を厚くする。
- 技術外の記事では、無理にプログラミングへ例えない。供給網なら単一障害点と代替経路、政策ならインセンティブと実装、科学なら測定方法と不確実性というように、エンジニアが扱い慣れた構造へ接続する。

## 中立性とファクトチェック

- 元記事、企業発表、政府発表、研究機関の解説をそのまま番組の見解にしない。中心的な主張を事実、当事者見解、分析、因果推論、予測へ分解して検証する。
- 重要な数字は母数、期間、定義、比較対象を確認する。研究は対象数、観察研究か介入研究か、相関と因果の区別、査読状況、効果量を可能な範囲で確認する。企業発表は決算、規制資料、競合他社、顧客や従業員側の資料とも照合する。
- 元記事と異なる結論だけでなく、同じ事実から異なる意味を読む視点も紹介する。例として、人員削減をAI代替だけでなく資本配分や採用反動として見る、重要物資指定を輸出制限ではなく供給能力への投資として見る、といった因果説明の違いを区別する。
- 反論は存在するだけで採用せず、根拠の質を評価する。根拠の弱い少数説を、有力な一次資料や科学的合意と対等に扱わない。利害関係者の主張は立場を明示する。
- 検証後も記事の主張が最もよく証拠に合う場合は、結論を弱めず、独立した根拠、適用範囲、実務上の意味を加えて補強する。反対意見の体裁を整えるためだけの反論は作らない。
- コメント欄、ソーシャル投稿、専門家コミュニティから、注目を集めた反応、繰り返し出る疑問、重要な技術的指摘、記事とは異なる見方を拾ってよい。ただし反応自体を事実確認の根拠にせず、その論点を一次資料と独立資料で再検証する。
- 反応数はそのコミュニティ内の注目度であり、一般世論や正しさではない。紹介する際は出所と規模を示し、正しい指摘は解説を加え、誤解は生じた理由も含めて訂正し、価値判断の違いは前提とトレードオフを整理する。
- 各トピックについて、内部では「主要主張」「裏付け」「注目された反応と検証結果」「反証または別解釈」「未確認事項」「現時点の評価」を整理してから台本を書く。音声では表形式を読み上げず、自然なニュース解説へまとめる。
- 「中立だから判断しない」で終えない。根拠に差があれば、現時点ではどの説明がより妥当かを理由付きで示す。証拠が不足する場合は、結論を変えるために必要な観測や資料を具体的に示す。

## Apple Podcastsのコンテンツ要件

- 番組説明と各エピソードのメタデータに、VOICEVOXによる合成音声を使用した番組であることを目立つ形で明記する。Apple Podcastsは合成ホストを含むAI生成音声について、番組と各話の内容・メタデータでの開示を求めている。
- メタデータは実際の内容を正確に表し、露骨な表現がある回は `itunes:explicit` を正しく設定する。ニュースの捏造、実在人物の発言を装う音声、誤解を狙う編集は行わない。
- 記事本文、画像、録音を転載せず、独自要約と解説に必要な最小限の引用だけを出典付きで使用する。BGM・SEは利用権を確認した完成音源だけを混合し、原本を配信しない。
- Apple Podcastsへの提出とApple Podcasts Connect上の公開操作は、アカウント所有者が最終的に行う。提出前に公式バリデーションを通す。

## 推奨する音声ファイル

- コンテナはMP4形式の `.m4a`、コーデックはAAC-LCとする。44.1 kHzまたは48 kHz、ステレオ128〜160 kbpsを標準にする。AppleはRSS配信でMP3とAACを受け付け、AACではADTSよりMP4コンテナを推奨している。
- `moov` atomを先頭へ置く `faststart` を必須にし、正確なシークとプログレッシブ再生を可能にする。
- 音量は番組全体を約 -16 LUFS、true peakは -1.5 dBTP以下を目安にする。話者間の聴感差、歯擦音、BGMダッキングも試聴する。
- ファイル名と公開URLはASCIIだけを使い、一度公開したエピソードURLを再利用・変更しない。

## 音声ホスティングとAirPlay

- 音声URLは公開された安定URLとし、認証、Cookie、期限付き署名URLを要求しない。HEADとRange要求を受け付け、Range GETへ `206 Partial Content` と正しい `Content-Range`、`Content-Length` を返す。
- `.m4a` は `Content-Type: audio/mp4` で配信し、インライン再生を妨げる `Content-Disposition: attachment` を付けない。AAC-LCのmonoまたはstereoはApple TVの対応範囲だが、AirPlayでは受信側がURLを直接取得する場合があるため、ブラウザー側の型指定だけに頼らない。
- 公開後にiPhoneまたはiPadのSafariとApple Podcasts相当のクライアントから再生・シークし、Apple TVへのAirPlay開始、途中シーク、画面ロック後の継続を実機確認する。
- 現在のGitHub Release assetはRangeには対応する一方、リダイレクト先が `application/octet-stream` と `Content-Disposition: attachment` を返す。このURLをPodcastとAirPlayの恒久的な配信元にはしない。
- 無料枠を超えると自動課金される従量制ストレージは、上限を技術的に0円へ固定できない限り採用しない。GitHub Pagesへ音声を置く案は正しいMIMEで配信できるか実測し、サイト容量と過去回保持の上限を決めてから採用する。

## RSS 2.0

- RSSは公開HTTPS URLに置き、RSS 2.0、`itunes`、`content` 名前空間を宣言する。番組にはtitle、link、description、language、author、category、explicit、copyright、show artworkを含める。
- 各話には一意で不変のGUID、title、descriptionまたはcontent、pubDate、link、`itunes:episodeType`、`itunes:duration`、`itunes:explicit`、enclosureを含める。
- enclosureには安定した音声URL、実ファイルと一致するbyte長、`audio/mp4`を設定する。ファイルを差し替えた場合はbyte長とdurationを再計測し、RSSと実体の不一致を公開前検査で失敗させる。
- 1トピックごとのチャプターを付ける。最初を `00:00:00` とし、少なくとも導入と5トピック、クレジットを記録する。RSSのPodcasting 2.0 chaptersまたはM4Aメタデータを採用する場合は、Apple Podcastsでの表示を実機確認する。
- 台本から正確なトランスクリプトを生成し、実際の合成音声との差分を検査する。Appleによる自動文字起こしを使う場合も、固有名詞と訂正箇所を確認する。

## 公開前検査

1. `ffprobe` でAAC-LC、サンプルレート、チャンネル数、duration、bit rateを確認する。
2. `ffmpeg` の解析でラウドネスとtrue peakを確認する。
3. HTTPのHEAD、通常GET、Range GETについて、status、Content-Type、Content-Length、Accept-Ranges、Content-Range、Content-Disposition、リダイレクト先を検査する。
4. RSSのenclosure byte長とdurationが実ファイルに一致することを検査する。
5. RSS validatorとApple Podcasts Connectの検証を通す。
6. Safari、iPhoneまたはiPad、Apple TVへのAirPlayで再生・シークを確認する。

## 現行実装の監査結果

- `top5.m4a` のAAC-LC、48 kHz、ステレオ、約160 kbps、faststartはAppleの推奨範囲に入っている。音声形式の変更より先にホスティング応答を直す。
- GitHub Release assetはRange GETへ206を返すが、最終応答が `application/octet-stream`、`Content-Disposition: attachment` で、期限付きURLへリダイレクトされる。Safariでの直接再生に成功しても、Apple TVが同じURLを取得するAirPlayの互換性は保証できない。
- 現在の音声RSSにはenclosure、GUID、pubDate、durationはあるが、Podcast提出に必要な番組アートワークと、推奨する番組・エピソードメタデータが不足している。ホスティングとアートワークを決めてからRSSを完成させる。
- Release assetを差し替えた後に `config/published-media.json` のbyte長とdurationが古いまま残った事例があった。今後はアップロード後のリモート実体を測定し、不一致なら公開検査を失敗させる。

## 公式確認先

- https://podcasters.apple.com/support/893-audio-requirements
- https://podcasters.apple.com/support/823-podcast-requirements
- https://podcasters.apple.com/support/891-content-and-subscription-guidelines
- https://podcasters.apple.com/support/829-validate-your-podcast
- https://podcasters.apple.com/support/5482-using-chapters-on-apple-podcasts
- https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/AirPlayGuide/PreparingYourMediaforAirPlay/PreparingYourMediaforAirPlay.html
