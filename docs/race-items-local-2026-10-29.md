# Ten race items / レースの道具10種類

Implementation included in the Release 76 source snapshot, 29 October 2026. Hosted deployment is separate.
2026年10月29日のRelease 76ソースに含みます。稼働サイトへの反映は別の公開作業です。

The six existing items remain available. Four additions:
従来の6種類に、以下の4種類を追加しました。

| Item / 道具                             | Effect / 効果                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🛡️ Combo Shield / コンボシールド        | Preserves an existing combo once when a mistake or hint would reset it. Does not award points for a wrong answer or change independent accuracy. / 間違い・ヒントによる連続正解のリセットを1回防ぎます。正誤・得点・自力正解率は変えません。                                                                                                                     |
| 🔄 Swap Card / チェンジカード           | Replaces the current question with a different word in the same question type. Counters, combo and accuracy do not advance. The old question ID becomes invalid. / 同じ題型の別の問題に交換します。回答数・連続正解・正解率は変えず、交換前の問題への送信は受け付けません。                                                                                      |
| 💎 Treasure Challenge / 宝箱チャレンジ  | Three consecutive independent correct main answers earn 150 extra points. A mistake or hint resets the challenge counter; review answers do not advance it. One payout per activation. / 自力で3問連続正解すると150点追加。間違い・ヒントでカウントをリセットし、復習の正解は含めません。1回の発動につき1回だけ加点します。                                      |
| 🧲 Catch-up Magnet / 追い上げマグネット | Immediately adds one quarter of the gap to the nearest higher score, rounded up and clamped to 20–150 points. Never subtracts another player's points. If overtaking has already removed the gap when activated, grants 20 points. / すぐ上の得点との差の4分の1を切り上げ、20〜150点を追加します。相手の得点は減りません。使用時に追い越していた場合は20点です。 |

## Integration / 組み込み

- All ten items share the same catalog for teacher switches, roulette art, student explanations and activation notices. English and Japanese are supported.
- Teachers can enable or disable each item. Existing restricted item selections remain restricted; a previous full six-item default upgrades to ten for newly created races. Existing race snapshots remain unchanged.
- Shield, treasure and swapped-task effects clear at the next course. Magnet points remain in total and course scores, including podiums and personal course summaries, without creating fictitious learning answers.
- Every item activation uses the existing player revision guard. Duplicate/stale submissions cannot award a second bonus; swapped-out questions cannot be answered later.

- 教師のON/OFF、抽選、学生の説明、発動通知で同じ道具一覧を使います。日英表示に対応しています。
- 既存の限定した道具選択は維持します。以前の6種類すべてを使う既定設定のみ、新規レース用に10種類へ更新します。開始済みレースの設定は変更しません。
- シールド・宝箱・交換問題は次のコースで解除します。マグネットの得点はコース順位・表彰・個人成績にも反映し、学習回答数には含めません。
- 更新番号による競合防止を維持し、再送による二重加点や交換前の回答を防ぎます。

## Verification / 検証

- 79 regression suites passed, including all ten adaptive question types, finite/endless swaps, old-question rejection, shield correctness, treasure reset/payout, catch-up caps, station cleanup and settings migration.
- Local browser rehearsal verified teacher checkboxes, student draw/activation, treasure progress and payout, and English descriptions/status. No console errors were observed in that rehearsal.
- This is local verification, not a physical school iPad/network test.

- 79組の回帰テストに合格しました。全10題型、有限／無限の問題交換、古い回答の拒否、シールド、宝箱、追い上げ得点、コース切替、設定更新を含みます。
- ローカルブラウザーで教師の道具選択、学生の抽選・発動、宝箱の進捗と加点、英語の説明・状態表示を確認しました。この確認中、コンソールエラーはありませんでした。
- 学校の実機iPad・Wi-Fiでの検証とは異なります。
