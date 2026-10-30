[![ここからすぐに使う / OPEN AOMIYALINGO](docs/teacher-start.svg)](https://aomiyalingo.minamiyakk.chatgpt.site/)

**ダウンロード・ZIPの解凍・インストールは不要です。 / No download, ZIP extraction or installation needed.**

ボタンを押して、先生用パスワードでログインしてください。<br>
Click the button and sign in with your teacher password. Internet access is required.

[📖 日本語の説明書 / Japanese PDF](public/help/teacher-guide.pdf) · [📖 English guide / 英語の説明書](public/help/teacher-guide-en.pdf)

<details>
<summary>予備のダウンロード / Optional download</summary>

[先生用スターターZIP / Teacher starter ZIP](https://github.com/AomiyaKT/aomiyalingo/raw/refs/heads/main/downloads/Aomiyalingo-Teacher-Kit.zip)

入口と日英PDFをパソコンやUSBに保存したい場合だけ使います。ZIPを展開して `START-HERE.html` を開いてください。<br>
Only needed to keep the launcher and both PDF guides on a computer or USB drive. Extract the ZIP and open `START-HERE.html`. The app still requires internet access.

</details>

---

# Aomiyalingo

[English](README.md) | **日本語**

Aomiyalingoは、青森県の小学校で使用されている英語教科書 **『Blue Sky』** の学習内容に合わせた、Duolingoのような感覚で学べる英語学習Webアプリです。単語練習やクラスのみんなで楽しむ単語レースを通して、授業の進め方に幅を持たせ、子どもたちが楽しく参加できる学習活動をサポートします。

先生も児童も、インターネットにつながり、対応するWebブラウザーが使えるパソコン・タブレット・スマートフォンなどから利用できます。児童はQRコードを読み取るか、リンクを開くだけで参加できます。

**現在のバージョン：Release 79 · 2026年10月30日**
[アプリを開く](https://aomiyalingo.minamiyakk.chatgpt.site/) · [更新履歴](CHANGELOG.ja.md) · [Release 79の技術情報（日英）](docs/release-79.md)

**ソースの版：** このリポジトリはRelease 79です。公開サイトへの反映は別作業です。GitHubへのアップロードだけでは、稼働中の授業サーバーは更新されません。

## 主な機能

- 5年生Unit 1〜8、6年生Pre Unit〜Unit 8に対応。画像・発音音声・例文を収録しています。5年生の語彙は159項目です。
- 初期表示は日本語。歯車から英語に切り替えられます。先生はログイン後、「単語練習」または「単語レース」を選びます。
- 全10種類の問題：意味の選択、聞いて選択、文字タイルでつづる、ことばのペア、文の並べ替え、文の穴うめ、音声のペア、聞いた文の並べ替え、聞いて穴うめ、聞き取り入力。
- 短いレッスン、答えに応じた支援、苦手な項目の復習、進捗の保存、詳しい回答記録。
- レースは3コース。標準設定は1コース6分・問題数無制限で、出題順は生徒ごとに異なります。アバター、準備完了、途中参加、道具、連続正解、ライブ順位、各コースの上位3位に対応しています。
- 一時停止・終了・リセット・参加受付の管理、間違いの確認、CSV出力、記録の削除・復元。
- 教材チェック、教材・ルール・自作音声のJSONバックアップと復元、完全プロジェクトZIPの作成スクリプト。

- 教材選択を「小学校・Blue Sky」→5年生／6年生のボタン→その学年の8単元に整理。モードごとに前回の選択を記憶します。
- 全10種類の道具。コンボシールド、チェンジカード、宝箱チャレンジ、追い上げマグネットを追加し、教師のON/OFFと日英の説明に対応しました。
- 歯車→状態に教師用の更新確認を追加。GitHubとの比較、公開済みの新しい版への再読み込み、サーバーへの公開待ちを区別します。授業中・未保存時は更新を止めます。

## 先生用ガイド

- [日本語PDF](public/help/teacher-guide.pdf)
- [英語PDF](public/help/teacher-guide-en.pdf)

各15ページで、現在の授業の流れを説明しています。歯車のガイドボタンは、選択中の表示言語に対応するPDFを開きます。

## 最近の更新

Release 79では、レースの状態切替と学生画面の後処理を共通化し、古い定期更新や回答応答が新しい画面を書き換えないようにしました。復習画面を離れると古い音声も停止します。途中で新しいレースに切り替えた場合は、前の時計を保持して終了し、誤ってコースクリアを表示しません。35人向けのテレビ順位表、画面幅に収まるQR画像、見出しとヘルプの位置も整理しました。採点・保存済み記録と各15ページのRelease 76日英ガイドは維持しています。[詳細](docs/release-79.md)と[更新履歴](CHANGELOG.ja.md)をご覧ください。

## 検証結果

- Release 79：回帰テスト92組が通過。35人のテレビ順位表（1366×768・1920×1080）、iPad相当の縦・横画面と高さの小さい画面をローカルで確認しました。測定値と検証範囲は技術情報に記載しています。
- 教材設定17組・設定項目387件のチェックで、エラー・警告ともに0件。旧形式の互換設定を含むため、重複のない単語が387語あるという意味ではありません。
- 35人・授業時間30分の加速シミュレーションで、30,452リクエスト、レース回答3,209件、再送200件、予期しないエラー0件。
- シミュレーションはローカルのWorker APIとSQLiteを使用しています。実機iPad・学校のWi-Fi・描画フレームレートの検証を置き換えるものではありません。

## 開発環境

Node.js 24 LTSとnpmを使用します。ローカルプレビューはNode.js内蔵のSQLiteを使用します。

```sh
npm ci
npm run check
npm run content:check
```

PowerShellでローカル確認用の先生用パスワードを設定し、一時プレビューを起動します。

```powershell
$env:TEACHER_PASSWORD = 'choose-a-local-preview-password'
node dev.mjs
```

http://127.0.0.1:8767/ を開きます。プレビューの記録はプロセスを停止すると消えます。

```sh
npm run build
npm run backup:project
node --expose-gc scripts/soak-classroom.mjs --output .sites-runtime/soak.json
```

公開アプリはCloudflare Workerと、`DB`として接続した永続D1データベースを使用します。`TEACHER_PASSWORD`はホスティング側のシークレット設定で指定します。新しいデータベースには`drizzle/`内のマイグレーションを順に適用してください。ビルド出力は`dist/server/index.js`です。

既存の公開先識別情報は`.openai/hosting.json`に残しています。GitHubへのアップロードだけでは、アプリの再公開・本番データベースの移行・オフラインサーバーの作成は行われません。別環境で公開する場合は、専用の公開先・データベース・シークレットを設定してください。公開済みアプリを使う先生に必要なのは、ブラウザーとインターネット接続です。

## フォルダー構成

| パス | 内容 |
| --- | --- |
| `public/` | ブラウザー用画面、翻訳、フォント、画像、音声 |
| `server/` | 授業・レース・教材編集・保存処理 |
| `db/`, `drizzle/` | データベースのスキーマとマイグレーション |
| `tests/`, `scripts/` | 回帰テスト、性能測定、授業シミュレーション、バックアップ処理 |
| `public/help/teacher-guide.pdf`, `public/help/teacher-guide-en.pdf` | 最新の日本語・英語先生用ガイド |
| `ARCHITECTURE.md`, `docs/` | 構成の説明、リリース情報、過去の開発メモ |

## ソースとプライバシー

アプリのソースは画面のRelease 79です。正確なスナップショットはリポジトリのコミット履歴で確認できます。ホスティング側の保存バージョン番号とは別です。以前の開発メモは`docs/project-history.md`に保存しています。

本番の生徒記録、成績出力、パスワード、依存ライブラリ、ビルド出力、実行時キャッシュ、一時配布ファイルは含みません。教材JSONバックアップにも生徒の成績やパスワードは含みません。成績はCSVで保存してください。内蔵素材はこのリポジトリに含まれます。

このリポジトリには、アプリのソースと同梱素材を公開しています。同梱する第三者素材の権利は元の権利者に帰属し、このリポジトリによって別途の再配布許諾が与えられるものではありません。
