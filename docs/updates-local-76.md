# Release 76: update checks / 更新確認

Included in the Release 76 source snapshot. Hosted deployment is separate from GitHub publication.
Release 76のソースに含みます。稼働サイトへの反映は、GitHub公開とは別の作業です。

## Teacher flow / 教師の操作

Open Settings → Status → Check for updates. The server checks the public
`AomiyaKT/aomiyalingo` repository; teachers do not need a GitHub account.
The panel shows the version loaded by this page, the public version, the last
check time, and a collapsible release-notes link. It defaults to Japanese and
follows the English interface switch.

「設定」→「状態」→「更新を確認」を押します。サーバーが公開リポジトリー
`AomiyaKT/aomiyalingo`を確認するため、教師のGitHubアカウントは不要です。
この画面の版・GitHubの公開版・最終確認時刻・更新内容へのリンクを表示します。
初期表示は日本語で、英語への切替にも対応します。

- **Server already newer:** offer a one-time reload to load the deployed version.
- **GitHub newer than the server:** show that deployment is pending. Do not claim
  that downloading source has updated the running website.
- **Local development version newer:** explicitly identify it as a development version.
- **GitHub unreachable, rate-limited, timed out, or invalid:** report that the
  latest version could not be verified, with a retry button.

- **サーバーが新しい場合：** 公開済みの版に切り替える更新ボタンを表示します。
- **GitHubだけが新しい場合：** サーバーへの公開待ちと表示します。ソースの
  ダウンロードを、稼働サイトの更新完了とは表示しません。
- **開発版のほうが新しい場合：** 開発版であることを明示します。
- **GitHubに接続できない場合：** 最新版か未確認であることと、再確認ボタンを表示します。

## Data and classroom protection / 保存・授業の保護

Checking is read-only. Only public release metadata is cached; no credentials or
student/classroom data are sent to GitHub. A reload requires a fresh authenticated
server preflight and is blocked by an active lesson or race (including lobbies and
paused sessions), in-flight saves, failed saves or unsaved editor changes. Closing
Settings while preflight is pending cancels the reload. No class is ended or
record deleted by either update endpoint.

更新確認は読み取り専用です。キャッシュするのは公開版の情報のみで、認証情報・
学生データ・クラス情報はGitHubへ送りません。更新直前にも認証・版・授業の状態を
確認します。授業／レース中（受付中・一時停止中を含む）、保存中、保存に失敗した
操作、未保存の編集がある場合は更新を止めます。確認待ちの間に設定を閉じた場合も
再読み込みしません。更新APIが授業を終了したり、記録を削除したりすることはありません。

## Hosting boundary / 公開作業との境界

The hosted Worker cannot overwrite its own deployed program from browser code.
A maintainer must still build, test and publish each new server version through
the hosting deployment workflow. This feature checks GitHub and loads a version
that has already been deployed; it is not a GitHub-to-hosting deployment pipeline.
GitHub currently has no formal Releases, so the checker supports the existing
`public/shared/release.js` version literal as a compatibility fallback without
executing that source. Future stable tags should use `v76`, `v76.1` or `v76.1.0`.

稼働中のWorkerを、ブラウザーからGitHubのソースで上書きすることはできません。
新しいサーバー版は、管理者がビルド・テスト・公開の手順で反映する必要があります。
この機能はGitHubの版を確認し、公開済みの版を読み込むもので、GitHubから公開先へ
自動デプロイする仕組みではありません。既存のGitHubには正式なReleasesがないため、
互換処理として`public/shared/release.js`の版番号も読み取ります。ソースは実行しません。

## Verification / 検証

81 regression suites passed. New coverage includes release validation, version
ordering, timeout/size/error handling, public-metadata cache coalescing, no
credential forwarding, live teacher authorization, read-only lesson/race guards,
stale versions, pending/failed saves, closing Settings and duplicate reloads.

81組の回帰テストに合格しました。版番号の比較、公開版の検証、通信失敗、時間・
サイズ制限、公開情報のキャッシュ、認証情報を転送しないこと、教師認証、授業・
レースの保護、古い版の拒否、未保存の操作、設定を閉じた場合、二重更新を検証しました。

Local browser checks also reached the real GitHub repository: the panel correctly
showed local Release 76 versus public Release 75, in Japanese and English. No
console errors were observed. Publishing this source does not redeploy the hosted site.

ローカルブラウザーから実際のGitHubにも接続し、作業版Release 76と公開版Release 75を
日英両方で正しく表示しました。確認中のコンソールエラーはありませんでした。
このソースの公開だけでは、稼働サイトの再公開は行いません。
