# Release 76 - 29 October 2026

## English

This source release includes the latest interface, race items, update checks,
performance work and Japanese/English teacher guides. The hosted app is deployed
separately; publishing this repository does not update the running server.

### Material selection

- Elementary school / Blue Sky is explicit. Large Grade 5 / Grade 6 buttons lead
  to eight units for that grade. Grade 6 begins with Pre Unit-Unit 1.
- Practice, Word Race and material editing share one component and remember
  selections separately. Existing profile IDs and historical class/race snapshots
  remain compatible.

### Ten race items

The existing Hint Light, Dash, Review Star, Double Hint, Double Star and Lucky
Clover are joined by:

| Item | Effect |
| --- | --- |
| Combo Shield | Preserves one combo reset after a mistake or hint. Does not change answer accuracy or grant points for a wrong answer. |
| Swap Card | Replaces the current word with another in the same question type. Does not advance answer counters or modify the shared question deck. Old question IDs are rejected. |
| Treasure Challenge | Three consecutive independent main answers earn an extra 150 points. A mistake or hint resets its counter; review answers do not advance it. One payout per activation. |
| Catch-up Magnet | Immediately adds one quarter of the gap to the next higher score, rounded up and capped at 20-150 points. Nobody loses points; if there is no higher score at activation, it grants 20. |

All ten have teacher switches, roulette art, activation/status feedback and
Japanese/English descriptions. Full previous defaults expand to ten for new
races; custom restricted item selections and existing race snapshots are retained.
Effects reset at course boundaries. Magnet points count in total/course rankings,
podiums and personal summaries without creating fictitious learning answers.

### Teacher update checks

Gear > Status > Check for updates reads public GitHub metadata through the
authenticated server, with bounded responses, a timeout and coalesced caching.
No teacher credential or student data is forwarded. Teachers do not need a
GitHub account. A newer already deployed server version can be loaded with a
one-time reload; active lessons/races, pending or failed saves, unsaved edits,
closed settings and stale version checks block that action. GitHub-only updates
are shown as awaiting deployment. This is not an automatic hosting deployment
pipeline.

### Performance and guides

- Immutable task JSON uses an exact-content, recursively frozen bounded LRU.
  Successful player saves serialize once. Live authorization, timers and learner
  states stay uncached.
- Ordinary practice reuses unchanged material parsing and avoids redundant text
  writes while preserving the Japanese source for reversible English presentation.
- Both teacher PDFs now have 15 pages, large text and clickable website links.
  New content covers material selection, every item and update/deployment limits.
- 81 regression suites passed. The 30 PDF pages were rendered and visually
  reviewed. Local browser checks exercised item draws, treasure progress/payout,
  teacher item switches, real GitHub version checks and Japanese/English layouts.
  These checks do not replace physical school iPad/Wi-Fi testing.

## 日本語

Release 76のソースには、新しい画面、道具、更新確認、性能改善、日英の先生用PDFを
含みます。稼働サイトへの反映は別の公開作業です。GitHub公開だけでは更新しません。

### 教材選択

「小学校・Blue Sky」を明示し、5年生／6年生の大きなボタンから、その学年の8単元を
選びます。6年生の最初はPre Unit-Unit 1です。練習・レース・教材編集で共通化し、
前回の選択をモードごとに記憶します。保存済み教材IDと以前の授業内容は維持します。

### 道具は合計10種類

従来の6種類に、コンボシールド、チェンジカード、宝箱チャレンジ、追い上げマグネットを
追加しました。シールドは連続正解を1回守り、カードは同じ題型の別問題へ交換します。
宝箱は3問連続の自力正解で150点追加。マグネットはすぐ上との得点差に応じて20〜150点を
追加し、相手の得点は減らしません。正誤・自力正解率の記録は書き換えません。

教師の個別ON/OFF、抽選、発動・進捗表示、日英説明、コース表彰に対応しています。
旧6種類すべてを使う既定設定は、新しいレース用に10種類へ拡張します。限定した道具選択と
開始済みレースは維持します。効果はコース切替で解除されます。

### 教師用の更新確認

歯車→状態→更新を確認から、サーバーがGitHubの公開情報を取得します。認証情報や学生情報を
GitHubへ送らず、先生のGitHubアカウントも不要です。サーバーに公開済みの新しい版がある場合に
読み込み直せます。授業中、保存中・未保存・保存失敗時、版が変わった場合などは更新を止めます。
GitHubにだけ新しい版があるときは、サーバーへの公開待ちと表示します。自動デプロイ機能ではありません。

### 性能・ガイド・検証

変更されないレース問題の解析を容量制限付きLRUで再利用し、状態の保存時の文字列化を1回にしました。
練習画面でも同じ教材の再解析と文字更新を減らしています。認証・タイマー・選手状態はキャッシュしません。
日英PDFは各15ページに拡張しました。81組の回帰テストに合格し、全30ページを画像化して確認しています。
ローカルの検証は、学校の実機iPad・Wi-Fiでの確認を置き換えるものではありません。
