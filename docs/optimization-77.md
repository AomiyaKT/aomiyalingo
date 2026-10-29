# Optimization pass 77 / 最適化 77

Prepared locally on 29 October 2026, based on the GitHub Release 76 source.
These changes do not modify scores, question order, saved records, schema or classroom controls.
The Release 76 teacher guides remain applicable because no teaching workflow changed.

## Runtime work

- Teacher personal clocks reuse the timer nodes already owned by the timing tower. The 250 ms clock callback no longer queries all ranking rows and their children. Text, accessible labels and warnings update only when their visible value or language changes. Paused, finished and unready late-joiner clocks retain their existing rules. Race resets replace node ownership.
- Rank animation measures every final row position before starting any animation. This avoids alternating layout reads and animation writes for each overtaking student. Column style and unchanged student avatar positions are retained.
- English UI translations use a 512-entry LRU limited to 131,072 combined source/output UTF-16 code units. Oversized strings bypass it. It is browser-local presentation data; authorization, answers and database state are not cached. Mutation batches scan outermost added subtrees once, and already translated observer echoes skip resolution. Captured answer values remain opaque; switching back to Japanese restores source text.
- Small packed audio expands once for simultaneous requests and enters the existing shared 4 MiB asset LRU by its expanded byte length. Each expanded entry is at most 256 KiB; at most eight shared inflations are pending. Burst overflow and oversized recordings retain streaming behavior. Consumers receive isolated bytes. Failed inflations are evicted and retryable. HEAD and 304 remain body/decode-free; API responses are outside this cache.
- Production browser JS and screen CSS are minified by the existing esbuild build. HTML links keep content-hash versioning, so changed bundles invalidate old browser cache entries automatically. Source remains readable in the repository.
- Failed speculative image/audio requests back off for 30 seconds, then may retry when needed. A temporary Wi-Fi failure no longer suppresses that resource indefinitely. Successful resources remain deduplicated; hidden/offline/save-data cancellation and size limits remain enforced.

## Verification

84 regression suites passed, including three new suites for translation bounds, personal clocks and packed speech bursts. Existing delivered classic bundles execute against the local Worker API, including ordinary practice and teacher refresh. New assertions verify one nested translation scan, no unchanged avatar style writes, and layout reads before rank animation writes.

Browser QA used a disposable local race with 35 simulated students and a 36th late joiner. Verified English labels, per-student clocks, pause/resume, avatar/ready, answer feedback and continuation; teacher/student browser logs showed no errors. No production classes were used. This does not replace a physical iPad or school Wi-Fi test.

Run `node scripts/check.mjs` and `node scripts/benchmark-optimization77.mjs --output <report.json>`.
The benchmark compares the same current source with/without browser minification, cached/uncached translation resolution, and the former per-request packed-speech expansion. It consumes all 35 audio response bodies and checks exact bytes. The prior packed bytes are already decoded before timing, matching the Release 76 warm-cache path.

One local run (synthetic Node CPU, not hosted latency or FPS):

| Workload | Before | After |
| --- | ---: | ---: |
| 35 labels × 20 refreshes, median | 11.282 ms | 0.105 ms |
| 35 simultaneous warm speech GET bodies, median | 26.783 ms | 9.706 ms |
| Race bundle | 376,385 bytes | 287,577 bytes |
| Teacher bundle | 241,820 bytes | 206,542 bytes |
| Practice connection bundle | 17,458 bytes | 9,663 bytes |
| Settings bundle | 208,055 bytes | 188,141 bytes |
| Material editor bundle | 28,187 bytes | 17,751 bytes |

Deterministic work checks: 1,000 identical dynamic English labels resolve once; 35 clocks perform zero text/attribute/class writes between displayed-second changes; 35 simultaneous requests for one small packed recording inflate once.

## 日本語

教師側の個別時計は順位表の要素を再利用し、表示秒・警告・言語が変わった場合だけ更新します。順位アニメーションは位置測定と描画を分け、学生側の変化のないアバター位置も書き直しません。

英語表示の翻訳は件数と文字数を制限して再利用し、まとめて追加された画面を重複走査しません。回答や教材の値は翻訳対象とせず、日本語への切替も維持します。

小さい圧縮音声は同時要求をまとめて1回だけ展開します。展開後の容量で4 MiBの上限を管理し、1件256 KiB・同時8件までに制限しています。大きい音声は従来どおりストリームで配信します。失敗した展開は再試行でき、認証や授業のデータはこのキャッシュに入りません。

配信用のJavaScriptとCSSを小さくし、通信が一時的に失敗した先読み素材は30秒後に再試行できるようにしました。操作手順・採点・保存形式・既存記録は変更していません。

84組の回帰テストに合格。ローカルの35人レースと途中参加者で、日英表示、時計、停止・再開、アバター、準備、回答と次の問題を確認しました。計測値はローカルの合成ベンチマークであり、実機iPadのFPSや学校の回線速度を保証するものではありません。
