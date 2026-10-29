# 横断監視とVCF専門監視

この監視は、一般ニュースの多様な選定を置き換えるものではない。一般ニュース約30件が本体であり、社会、国際、経済、科学、暮らし、文化、娯楽、スポーツ、地域、人物、ネット文化を広く扱う。

AIと一般脆弱性の監視は、重要な候補を発見し損ねないための横断チェックである。監視したという理由だけで採用枠を予約せず、一般ニュースへ採用する場合は通常の話題性、重要性、多様性、重複除外、テクノロジー・セキュリティ40％上限を適用する。

VCF、vSphere、ESXi、vCenter、vSAN、NSX、HCX、VCF Operations、VCF Automation、Tanzu／VKS、vDefend、Security Services Platform、Avi Load Balancer、VCSPは仕事上の専門監視枠とする。一般ニュース件数、分野比率、Top 5へ混ぜず、重要な新情報だけを0〜5件掲載する。

## 日次巡回記録

2026年10月30日版以降は、`config/monitoring-sources.json` の `requiredDaily: true` の全項目について、日次JSONの `monitoringReview.entries` に次を記録する。

- `sourceId`: 設定ファイルのID
- `status`: `checked`、`restricted`、`failed`
- `checkedAt`: 実際の確認時刻
- `note`: 何を確認したか、または確認不能理由
- `evidenceUrls`: 実際に開いた一覧、記事、検索結果、公式文書のURL

ログイン要求、地域制限、robots制限、削除、障害は回避しない。`restricted` または `failed` とし、代替の公式資料や信頼できる公開情報を `evidenceUrls` と `note` に残す。確認不能を `checked` と記録してはいけない。

巡回で重要候補を発見した場合は `monitoringReview.findings` に記録し、`included`、`deferred`、`not-relevant` のいずれかと理由を付ける。重大または高重要度の脆弱性、悪用確認、パッチ撤回、データ損失、停止推奨、互換性喪失を、単に一般ニュースの件数上限を理由として `deferred` にしてはいけない。VCF関連なら専門枠で扱う。

## 優先する専門情報

- VMSAとBroadcom Support PortalのVCF区分、Application Networking and Security区分
- Avi Controller、Service Engine、Avi Operations、WAF、GSLBの脆弱性、修正版、回避策、既知障害、サポート終了
- vDefend Firewall、NSX、Security Services Platformの検知欠落、フロー欠落、容量問題、センサー停止、ポリシー適用不具合、脆弱性、互換性
- VCF OperationsでVMSAや診断情報が欠落する問題
- vCenter、ESXi、vSAN、NSX、HCXのアップグレード停止推奨、back-in-time制限、パッチ撤回・再公開
- ライセンス、価格、VCSP、パートナー、サポート、EoA・EoS

「製品自体は非該当だが、WAFなどで背後の脆弱なサービスを緩和できる」という情報も、運用上の意味があれば候補へ残す。ただし製品が脆弱であるかのように表現してはいけない。

## 検証

`npm run validate:data` は、適用開始日以降の版で必須巡回先の欠落、未知ID、重複ID、確認不能理由の欠落を失敗させる。また一般ニュースとVCF専門枠を分離し、一般ニュース内のテクノロジー・セキュリティ上限とTop 5の媒体・分野バランスを検査する。
