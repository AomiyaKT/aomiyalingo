# Release 82 — iPad audio byte-range responses

2 November 2026. Emergency media compatibility fix; scoring, authentication and
saved classroom records are unchanged.

The hosted static audio responder previously ignored Range requests. A production
probe of music.wav with Range: bytes=0-1 returned HTTP 200 and all 70,358 bytes.
Apple documents byte-range support as an iOS media server requirement:
https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/CreatingVideoforSafarioniPhone/CreatingVideoforSafarioniPhone.html

Static audio now advertises Accept-Ranges: bytes and returns HTTP 206 with exact
Content-Range and Content-Length for a valid single range. Closed, open-ended and
suffix ranges operate on the original media after bundle decompression. Invalid
positions return 416; unsupported multi-ranges and mismatched If-Range validators
fall back to the full representation. HEAD and conditional 304 retain lazy paths.
The bounded shared decompression cache and streaming overflow path are preserved.

Regression checks cover cold compressed streams, warm expanded entries, large
streaming-only media, raw audio, byte-exact slices, suffix/open-ended requests,
invalid positions, validators, HEAD and every bundled word recording. This fixes
a reproduced server compatibility defect; it does not establish that all physical
iPads or school network conditions have been tested. Teacher-uploaded API audio
and browser speech synthesis are separate paths and are not changed here.

## 日本語

2026年11月2日。iPad音声の互換性修正です。採点、認証、保存済み記録は変更しません。
本番の単語録音で、先頭2バイトの要求にファイル全体を返す問題を再現しました。
静的音声の分割取得に対応し、正しい206応答と範囲・長さを返します。圧縮前の録音の
バイト位置で処理し、キャッシュ済み・初回・大きい音声の経路を検証します。
全単語録音の先頭2バイト取得も回帰検証に含めます。実機iPadや学校の通信環境すべてでの
動作確認を意味するものではありません。先生が登録したAPI音声と端末の読み上げは別経路です。
