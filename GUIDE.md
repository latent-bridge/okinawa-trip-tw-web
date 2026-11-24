# 沖繩交陪の目的別ガイド

公式トップは地域やテーマを選ぶ入口とし、商品を扱う店、店頭受取、乗り場、現地の目印は /guide/ で案内する。慶良間から泊港、北部から名護のケーキ店、買物から商品検索へ直接つながる。店舗の情報源・確認日・未確認の範囲は編集リポジトリに記録し、繁体字と日本語確認版を一緒に更新する。

- [本番のガイド](https://okinawa-kaupue.com/guide/)
- [編集用リポジトリ](https://github.com/latent-bridge/okinawa-kaupue-guide)
- [ガイドの配信用リリース](https://github.com/latent-bridge/okinawa-kaupue-guide-preview/releases)
- [確認済みサイト一式の配備履歴](https://github.com/latent-bridge/okinawa-trip-tw-web/actions/workflows/deploy-approved.yml)

## 公開と復旧

1. 公式サイトの候補を用意する。配信用ディレクトリには、その時点の本番の全ファイルと、今回承認された変更を含める。公式サイトのmainは配備済みのtarと一部内容が異なる。編集原稿、裏取り台帳、申請者情報は配備物の外に置く。
2. 新しい公開候補にガイドを含める。既存の正式版を引き継ぐときはそのまま維持する。ガイドを更新するときは、編集側で配信用ZIPをリリースし、tools/install_guide.py の版とSHA-256を更新する。候補に旧 guide/ を含めず、公式サイト一式のディレクトリを指定して次を実行する。

   ~~~sh
   python3 tools/install_guide.py _site
   ~~~

   取得済みZIPを照合して使う場合は末尾に --zip okinawa-guide.zip を付ける。本番では各記事のブランド名が公式トップへ、ガイド一覧リンクが /guide/ 内へ戻る。
3. トップ・慶良間・北部・買物の入口、空の検索欄、商品名「4號」の結果2件（v0.2.1）、泊港記事の略図・日本語切替を確認する。チームの手動配備では、確認したサイト全体を通常ファイルだけのtarとしてGitHub Releaseに保存する。deploy-approved.yml にそのアセット番号とSHA-256を渡す。公開後も独自ドメインで同じ経路を確認する。
4. 復旧は、直前の配備で使った全サイトtarを同じ手順で指定する。初回のガイドを取り下げる場合の直前版は pages-c37-20261122 の candidate.tar（アセット777899964）。今後の配備では直前の公開履歴を参照する。
