# Release 83 — prepare assigned recordings before students are ready

11 November 2026.

Students now download the assigned activity's recorded audio while choosing an
avatar or reviewing the practice overview. Word Race receives a deduplicated
recording manifest from the race's immutable selected vocabulary snapshot; thin
student polls retain it through the existing private snapshot merge. It contains
only recording paths, not answers or future task solutions. Vocabulary Practice
uses its assigned vocabulary, including teacher-added recordings.

Readiness stays disabled until every recording has completely downloaded. Race
readiness and all practice-start handlers also check the gate, so a UI redraw or
programmatic button invocation cannot skip preparation. Progress, failure and
retry states are shown in Japanese and English. Retries download only missing
recordings. The rule briefing is available before pressing Ready, after the
avatar section. Returning to a prepared page keeps its completed recordings.

`public/shared/audio-preparation.js` owns this required preparation, with one
instance installed by `network-entry.js` per page. It keeps at most two fetches
in flight, a 20-second request deadline, an 8 MiB per-recording limit and a
48 MiB activity limit. Only same-origin public media and audio API identifiers
are accepted. Partial, empty, oversized, failed or non-audio responses cannot
unlock readiness. An activity generation cancels stale requests and revokes old
blob URLs when the participant/activity changes.

Complete recordings stay as activity-owned blob URLs. Word, matching and ordinary
practice playback use that shared resolver, avoiding another media-network fetch
after Ready, including Safari's distinct media cache path. Optional next-task
image/audio warming remains in its existing bounded speculative preloader.

Sentence audio and words without recordings use the existing device speech
synthesis. They cannot be downloaded as recording files; the preparation panel
states that distinction. Preparation does not override the device's audio volume,
speech voice availability or user-gesture playback requirements. Reloading a page
recreates its in-memory audio cache; teacher settings and saved answers retain
their existing formats. No database migration is required.

## Verification

All 93 regression suites pass. The content audit reports 17 profiles / 387
configured entries, zero errors and zero warnings. English race and Japanese
practice browser rehearsals pass, including a direct readiness-handler invocation
while loading, cancellation back to entry, and successful native playback of
prepared recordings while offline. Browser page execution errors: zero.

Automated coverage includes complete-body gating, two-request concurrency,
failed-only retry, activity changes, stale completion, blob playback resolution,
invalid responses, timeouts, TTS-only activities, and retention of the race audio
manifest across thin polls. Browser rehearsals use a disposable local classroom,
the built Worker and 768×1024 student pages. They inject slow downloads and a failed
recording, check that readiness stays disabled even while changing avatar, retry,
start both modes, and check playback from prepared blob sources with the browser
offline. No production students or scores are modified. This is not an assertion
that every physical iPad or school network has been tested.

## 日本語

2026年11月11日。アバター選択や練習内容の確認中に、今回使用する録音を読み込みます。
レースは保存された使用語彙、通常練習は配布された語彙を対象にします。全録音の受信が
完了するまで準備完了・練習開始を無効にし、進捗、失敗、再試行を表示します。
失敗時は未完了の録音だけを再取得します。レースのルールは準備完了前にも確認できます。

録音はページ内に保持し、回答時は保持した音声を再生します。同時取得2件、1件20秒、
録音1件8 MiB、活動全体48 MiBを上限とし、活動変更時は古い取得と保持URLを破棄します。
本文を最後まで受信していない応答や、音声でない応答では準備完了になりません。

文章の音声と録音のない語は、従来どおり端末の読み上げを使用します。録音ファイルとして
先にダウンロードするものではないため、準備画面にもその旨を表示します。ページを
再読み込みすると、音声の保持領域は作り直されます。採点、認証、保存形式は維持します。

ローカルの破棄可能な授業で、遅い取得、録音1件の失敗、再試行、両モードの開始、
取得済み音声のオフライン再生を確認します。本番の児童や成績は使用しません。
実機iPadや学校の通信環境すべてでの確認を意味するものではありません。
