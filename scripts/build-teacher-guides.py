"""Rebuild the Japanese and English teacher PDFs. Requires reportlab and pypdf.

All outputs stay inside this project. Pass --font-dir to use an alternate folder
containing meiryo.ttc, meiryob.ttc, arial.ttf and arialbd.ttf.
"""
from pathlib import Path
import argparse
import shutil
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfdoc import PDFString
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://aomiyalingo.minamiyakk.chatgpt.site/'
EDITION = '2026-10-29'
RELEASE = '76'
PAGES = [
    (
        ('まずは、ここから', 'ログインしたあと、学び方を選びます。'),
        ('Start here', 'Sign in first, then choose how your class will learn.'),
        [
            ('先生のホームを開く', '下のリンクをブラウザーで開きます。このガイドはRelease 76用です。公開サイトへの新機能の反映は、管理者が別途行います。', 'Open the teacher home', 'Open the link below. This guide covers Release 76. New features reach the hosted website after a separate administrator deployment.'),
            ('パスワードを入力する', '先生用パスワードを入力してログインします。生徒にパスワードを伝える必要はありません。', 'Enter the teacher password', 'Sign in with your teacher password. Students do not need this password; they use the QR code for your class.'),
            ('学び方を選ぶ', '「単語練習」または「単語レース」を選びます。教材とルールは、それぞれのモードで設定します。', 'Choose a learning mode', 'Choose Vocabulary Practice or Word Race. Select the material and adjust the rules within that mode.'),
            ('日本語・英語を切り替える', '歯車の「表示言語」で切り替えます。初期表示は日本語です。設定は使っているブラウザーに保存されます。', 'Switch Japanese / English', 'In the gear menu, change Interface language. Japanese is the default. This preference is saved in the current browser.'),
        ],
    ),
    (
        ('通常の練習を始める', '生徒が自分のペースで、短いレッスンを進めます。'),
        ('Start Vocabulary Practice', 'Students work through short lessons at their own pace.'),
        [
            ('Blue Sky・学年・単元を確認', '「小学校・Blue Sky」を確認し、5年生か6年生のボタンを押します。その学年の8単元から選び、単語の範囲とクラス名を確認します。', 'Choose Blue Sky, grade and unit', 'Check Elementary school / Blue Sky. Press Grade 5 or Grade 6, then choose from that grade\'s eight units. Check the word range and class name.'),
            ('ルールを確認して開始する', '必要なら「ルールを変更」で調整します。標準は1レッスン6問。設定を確認してクラスを開始します。', 'Check the rules and start', 'Use Change rules if needed. The default is six main questions per lesson. Review the settings and start the class.'),
            ('授業のQRを見せる', '生徒はiPadでQRを読み取り、出席番号を確認して参加します。教材やモードを生徒が選ぶ必要はありません。', 'Show this class QR code', 'Students scan it with their iPads and confirm their student number. They do not need to select a unit or learning mode.'),
            ('進み具合を見る', '回答数・正答率・ヒントや間違いを確認します。短いレッスンの区切りで休めます。復習が追加されることもあります。', 'Monitor progress', 'Check answers, accuracy, hints and mistakes. Students can pause between short lessons. Review questions may be added.'),
        ],
    ),
    (
        ('問題は全部で10種類', 'ステップアップ形式では、問題を組み合わせて学びます。'),
        ('Ten question types', 'Step-up learning combines word, sentence and listening tasks.'),
        [
            ('ことばの基礎：3種類', '英語の意味を選ぶ・英語を聞いて選ぶ・文字を選んでつづる。選んだ文字は、もう一度押すと戻せます。', 'Word foundations: 3 types', 'Choose a meaning, listen and choose the English word, or spell with letter tiles. Tap a selected letter to return it.'),
            ('ペアをつなぐ：2種類', '英語と意味をつなぐ「ことばのペア」と、音声を聞いてつなぐ「音声のペア」があります。', 'Matching: 2 types', 'Match English words to meanings, or listen to audio and match it to the corresponding word or meaning.'),
            ('文をつくる：2種類', '語を並べて文をつくる問題と、文の空欄を埋める問題です。画面に表示される指示に従って答えます。', 'Sentence work: 2 types', 'Put word tiles in order to build a sentence, or fill a gap in a sentence. Follow the instructions on screen.'),
            ('聞いて答える：3種類', '聞いた文を並べる・聞いて空欄を埋める・聞こえた英語を入力する。ヒントの使用は記録に残ります。', 'Listening production: 3 types', 'Order a sentence you hear, fill a listening gap, or type what you hear. Hint use is recorded for the teacher.'),
        ],
    ),
    (
        ('単語レースを準備する', '先生が開始するまで、生徒は待機画面で準備します。'),
        ('Prepare a Word Race', 'Students prepare in the lobby until you start the race.'),
        [
            ('教材とルールを決める', '単語レースでBlue Sky・学年・単元を選びます。6年生の最初はPre Unit-Unit 1です。前回の選択はモードごとに記憶されます。', 'Choose material and rules', 'In Word Race, choose Blue Sky, the grade and unit. Grade 6 starts with Pre Unit-Unit 1. Each mode remembers its last selection.'),
            ('参加受付を始める', '参加受付を開き、生徒にQRを見せます。生徒は出席番号で参加し、好きな動物を選びます。', 'Open the lobby and show the QR', 'Press Open lobby. Students scan the QR, enter their student number and choose an animal avatar.'),
            ('準備完了を確認して開始', '生徒が「準備完了」を押すと、先生の画面に準備状況が表示されます。確認後、レースを開始します。', 'Check readiness, then start', 'Students press Ready after choosing their avatar. Check readiness on your screen, then start the race.'),
            ('遅れた生徒も参加できます', '参加受付が開いていれば途中参加できます。受付の開閉はQR付近で操作します。レースを作り直す必要はありません。', 'Allow late joiners', 'Students can join while joining remains open. Use the joining control beside the QR. You do not need to restart the race.'),
        ],
    ),
    (
        ('レース中の操作', '標準：1コース6分・3コース・時間内は問題数無制限。'),
        ('During the race', 'Default: three courses, six minutes each, unlimited questions.'),
        [
            ('1人ずつ、状況を確認する', '順位・得点・残り時間・回答数・現在の題型を確認できます。問題の順序は生徒ごとに異なります。', 'Follow each learner', 'View position, score, personal time remaining, answer count and current question type. Question order differs by student.'),
            ('正解・連続正解・道具で得点', '正解と連続正解で得点し、道具の効果が加わることがあります。回答速度そのものの加点はありません。', 'How scoring works', 'Correct answers and streaks earn points. Items can add effects or bonuses. There is no separate answer-speed bonus.'),
            ('一時停止・続きから再開', '説明や休憩には一時停止を使います。再開すると続きから進みます。終えるときは隣の終了ボタンを使います。', 'Pause, resume or end', 'Pause for an explanation or break, then resume. Use the adjacent End race button when you want to finish early.'),
            ('各コースの結果を見て次へ', '各コースの終了後に上位3位を確認します。次のコースは先生が開始します。全コース後は最終結果を確認します。', 'Review results, then continue', 'Check the top three after each course. The teacher starts the next course. After all courses, review the final results.'),
        ],
    ),
    (
        ('コースごとにステップアップ', '標準のステップアップ形式：各コースに4種類。'),
        ('The three course stages', 'Default step-up format: four question types in each course.'),
        [
            ('コース1：ことばの基礎', '意味を選ぶ・ことばのペア・スペリング・英語を聞いて選ぶ。まずは単語の基礎を確かめます。', 'Course 1: word foundations', 'Meaning choice, word matching, spelling and listening choice. Students begin with core vocabulary.'),
            ('コース2：文づくりへ', '文を並べる・文の穴うめ・音声のペア・聞いた文を並べる。文と音声を使って練習します。', 'Course 2: build sentences', 'Sentence ordering, sentence gaps, audio matching and audio sentence ordering. Students work with sentences and sound.'),
            ('コース3：聞いて書く', '文を並べる・文の穴うめ・聞いて穴うめ・聞き取り入力。最近の答えに合わせて支援の量を調整します。', 'Course 3: listen and produce', 'Sentence ordering, sentence gaps, audio gaps and dictation. The amount of support adapts to recent answers.'),
            ('道具は画面で効果を確認', '道具が届くと抽選の演出が表示されます。受け取った道具の説明を読み、使えるボタンが出たら押します。', 'Read the item effect on screen', 'An item roulette appears when an item arrives. Read the awarded item description and press its button when it is available.'),
        ],
    ),
    (
        ('生徒に伝えること', 'このページを読み上げて、参加方法を説明できます。'),
        ('What to tell students', 'You can read these instructions aloud before the game.'),
        [
            ('自分の出席番号を確認', '「QRを読んだら、自分の出席番号を入れてね。別の人の番号になっていないか、確認してから参加しよう。」', 'Check your own number', '"Scan the QR and enter your own student number. Check it carefully before joining. Do not use another student\'s number."'),
            ('動物を選んで、準備完了', '「動物を選び、準備完了を押そう。待っている間は、画面で教材・問題・道具の説明を読んでね。」', 'Choose an animal and get ready', '"Choose an animal and press Ready. While you wait, read the material, question and item information on your screen."'),
            ('教科書を見てもOK', '「この単元の教科書を見ても大丈夫。あわてず正しく答えよう。正解や連続正解で得点が増えるよ。」', 'You may use the textbook', '"You may look at the textbook for this unit. Think carefully. Correct answers and streaks earn points; items can help too."'),
            ('終わったら、そのまま待つ', '「時間が終わったら、復習して待っていてね。次のコースは先生が始めるよ。画面は閉じないでね。」', 'Stay on this screen when done', '"When time is up, you can review while waiting. I will start the next course. Keep this screen open."'),
        ],
    ),
    (
        ('成績・リセット・削除', 'リセットと削除は、役割が異なります。'),
        ('Results, reset and deletion', 'Resetting a race and deleting its records are different actions.'),
        [
            ('必要な記録を確認・保存', '通常練習とレースは別々に管理します。回答・間違い・ヒントを確認し、必要な成績をCSVで保存します。', 'Review and export results', 'Practice and race records are managed separately. Review answers, errors and hints. Export results as CSV when needed.'),
            ('新しく設定し直す：リセット', '進行中はリセット、終了後は「新しいレースを準備」を使います。新しい準備画面へ戻り、それまでの成績は保存されます。', 'Reset or prepare a new race', 'Use Reset race during a race, or Prepare a new race after it ends. Both return to setup and keep the existing results.'),
            ('不要な記録は回収箱へ', '削除の確認画面で対象を確かめます。終了したレースなどを回収箱へ移したあと、戻すこともできます。', 'Move unwanted records to the bin', 'Check the target in the confirmation dialog. Finished races and other supported records can be moved to the recycle bin and restored.'),
            ('完全削除は元に戻せません', 'レースの回収箱では1件ずつ、または全部を完全削除できます。必要な記録を保存してから実行してください。', 'Permanent deletion cannot be undone', 'In the race recycle bin, delete one entry permanently or empty the bin. Save any results you need before confirming.'),
        ],
    ),
    (
        ('教材と使いやすさの設定', '教材の変更と、この端末の表示設定を分けて考えます。'),
        ('Material and device settings', 'Teaching rules and this browser\'s display settings are separate.'),
        [
            ('各モードで教材・ルールを編集', '練習は「単語・練習の設定」、レースは「単語・ゲームの設定」を開きます。変更後は保存してください。', 'Edit material within each mode', 'Open the vocabulary/practice settings or vocabulary/game settings in the relevant mode. Save your changes before closing.'),
            ('変更は新しい授業から', '進行中のクラスやレースは、開始時の内容を使います。新しい設定を使うには、新しいクラスやレースを準備します。', 'Use changes in a new session', 'An existing class or race keeps the settings captured when it was created. Prepare a new class or race to use the edited settings.'),
            ('歯車で音・文字・動きを調整', '音量・文字サイズ・くっきり表示・動きの軽減・表示言語を変更できます。設定はこのブラウザーに保存されます。', 'Use the gear for sound and display', 'Adjust volume, text size, clearer outlines, reduced motion and interface language. Preferences are stored in this browser.'),
            ('音楽は先生の画面だけ', '先生の音楽は初期音量20％。生徒のQR参加画面では流れません。最初は画面を一度押す必要がある場合があります。', 'Music is for teacher screens only', 'Teacher music defaults to 20% volume. Student QR pages do not play background music. A first click may be needed to enable audio.'),
        ],
    ),
    (
        ('教材チェックとバックアップ', '歯車 →「状態」から開きます。'),
        ('Content check and backups', 'Open the gear menu, then Status, to find these tools.'),
        [
            ('授業前に教材チェック', '画像・音声の不足や、選択肢・例句の問題を確認できます。自動チェックに加え、意味や自然な表現は先生が確認します。', 'Check content before teaching', 'Find missing pictures or audio and flagged choice/sentence issues. Teachers should also check meaning and natural wording themselves.'),
            ('教材・ルールをJSONで保存', '「バックアップと復元」で教材・例句・ルール・関連する自作音声を保存します。生徒の成績やパスワードは含みません。', 'Save teaching settings as JSON', 'Backup & restore exports materials, examples, rules and referenced custom audio. It does not include student results or passwords.'),
            ('復元前に件数を確認', 'JSONを選び、教材や音声の件数を確認してから復元します。復元前の設定は自動保存され、ダウンロードできます。', 'Preview before restoring', 'Select a JSON backup, check its material/audio counts, then confirm restore. The previous settings are saved and can be downloaded.'),
            ('成績とアプリ本体は別に保存', '成績はCSVで保存します。内蔵画像・音声を含むアプリ本体は完全プロジェクトに含まれます。オンライン利用には通信が必要です。', 'Keep results and app files separately', 'Export results as CSV. Built-in media are included in the complete project, not the teaching JSON. The hosted app needs internet access.'),
        ],
    ),
    (
        ('困ったとき・授業前の確認', '先生のWindowsと、生徒のiPadをインターネットへ。'),
        ('Before class and troubleshooting', 'Both the teacher computer and student iPads need internet.'),
        [
            ('画面をテレビに映す', 'Windows標準のキャスト機能で接続します。先生はEdgeやChrome、生徒はiPadのSafariで使えます。追加ソフトは不要です。', 'Show your screen on the TV', 'Use the built-in Windows Cast feature. Use Edge or Chrome on the teacher PC and Safari on iPads. No extra student app is needed.'),
            ('通信が切れたら', 'Wi-Fiを確認し、画面を閉じずに再送信します。同じiPad・同じブラウザーで開き直し、サイトデータは消さないでください。', 'If the connection fails', 'Check Wi-Fi and retry without closing the page. Reopen in the same browser on the same iPad. Do not clear the website data.'),
            ('授業前に1台で試す', '先生のログイン・テレビ表示・QR参加を確認します。iPadで音声を聞き、2問答え、先生の画面に反映されるか確認します。', 'Test with one iPad before class', 'Check teacher login, TV display and QR joining. Play audio, answer two questions and confirm that the teacher screen updates.'),
            ('使える教材', '小学校Blue Sky：5年生Unit 1〜8、6年生Pre Unit-Unit 1〜Unit 8。以前の授業・レースは、作成時の教材とルールを保持します。', 'Available teaching material', 'Elementary Blue Sky: Grade 5 Units 1-8 and Grade 6 Pre Unit-Unit 1 through Unit 8. Earlier classes and races retain their original material and rules.'),
        ],
    ),
]

# Keep four large, readable cards per page. Item effects are grouped separately
# rather than compressing ten descriptions into a small table.
ITEM_PAGES = [
    (
        ('道具ガイド 1：ヒントと復習', '標準は6問ごとに抽選。答える前に道具を使います。'),
        ('Items 1: hints and recovery', 'Default: one item draw every six main answers. Use it before answering.'),
        [
            ('ヒントライト', '選択肢を1つ減らします。スペリングは最初の1文字。題型に合うヒントが出ます。使って正解した場合は、標準70点です。', 'Hint Light', 'Removes one wrong choice or reveals the first spelling letter. Other tasks receive matching support. A correct answer with a hint earns 70 points by default.'),
            ('ダブルヒント', '選択肢を2つ減らします。スペリングは最初の2文字。ヒントでの正解は自力正解と分けて記録し、標準70点です。', 'Double Hint', 'Removes two wrong choices or reveals the first two spelling letters. Hinted answers are recorded separately from independent answers and earn 70 points by default.'),
            ('ダッシュ', '次の2回の自力正解に、それぞれ40点を追加します。間違いやヒントで答えても、残りの加点回数は減りません。', 'Dash', 'Adds 40 points to each of the next two independent correct answers by default. A mistake or hinted answer does not consume a remaining boosted answer.'),
            ('復習スター', '間違えたことばに再挑戦し、正解すると標準60点です。復習することばがあるときに抽選されます。連続正解数には含みません。', 'Review Star', 'Retries a previously missed word for 60 points by default. It is drawn only when a missed word is available. Review answers do not build the main combo.'),
        ],
    ),
    (
        ('道具ガイド 2：ボーナスと守り', '道具で得点が変わっても、学習の正誤記録は残ります。'),
        ('Items 2: bonuses and protection', 'Items can change game points; learning answers remain recorded.'),
        [
            ('ダブルスター', '次の自力正解の基本得点を2倍にします。標準では100点を追加します。連続正解ボーナスを丸ごと2倍にする道具ではありません。', 'Double Star', 'Doubles the base points of the next independent correct answer: an extra 100 points by default. It does not double the entire combo bonus.'),
            ('ラッキークローバー', '次の自力正解に20・40・60・80点のいずれかを追加します。間違い・ヒントでは効果を消費しません。', 'Lucky Clover', 'Adds a random 20, 40, 60 or 80 points to the next independent correct answer. A mistake or hinted answer does not consume it.'),
            ('コンボシールド', '間違い・ヒントで連続正解がリセットされるのを1回防ぎます。間違いの得点は0点のまま。正誤や自力正解率は変えません。', 'Combo Shield', 'Prevents one combo reset caused by a mistake or hint. A wrong answer still earns zero points. Correctness and independent accuracy do not change.'),
            ('チェンジカード', '今の問題を、同じ種類の別の問題に交換します。交換だけでは得点・回答数・正解率・連続正解は変わりません。', 'Swap Card', 'Replaces this question with another of the same type. Swapping alone does not change points, answer count, accuracy or combo.'),
        ],
    ),
    (
        ('道具ガイド 3：挑戦と追い上げ', '使う道具は、先生がレースのルールで選べます。'),
        ('Items 3: challenge and catch-up', 'Teachers choose which items are enabled in the race rules.'),
        [
            ('宝箱チャレンジ', '使ったあと、自力で3問連続正解すると150点を追加。途中の間違い・ヒントで0/3に戻ります。1回の発動で1回だけ加点します。', 'Treasure Challenge', 'After activation, three consecutive independent correct main answers earn 150 extra points. A mistake or hint resets progress to 0/3. Each activation pays out once.'),
            ('追い上げマグネット', 'すぐ上の人との得点差に応じて20〜150点を追加します。相手の得点は減りません。使用時に追い越していた場合は20点です。', 'Catch-up Magnet', 'Immediately adds 20-150 points based on the gap to the next higher score. Nobody loses points. If you have already overtaken that player, it grants 20 points.'),
            ('抽選とコースの切り替わり', '標準は6問ごとに抽選します。成績に応じて補助道具が出やすくなります。シールドや宝箱などの効果は、次のコースで解除されます。', 'Draws and course changes', 'Items are drawn every six main answers by default, with extra support weighted toward learners who need it. Active shields, treasure and other effects reset at the next course.'),
            ('道具を選ぶ・得点を調整する', 'レースのルールで10種類を個別にON/OFFできます。正解・ヒント・復習・ダッシュの点数などは変更可能。設定は新しいレースから使います。', 'Enable items and adjust scoring', 'Turn each of the ten items on or off in race rules. Base, hint, review and Dash points can be adjusted. Saved settings apply to newly created races.'),
        ],
    ),
]
PAGES[6:6] = ITEM_PAGES
PAGES.insert(-1, (
    ('更新を確認する', '歯車 →「状態」→「更新を確認」。教師だけの機能です。'),
    ('Check for updates', 'Teacher only: gear menu > Status > Check for updates.'),
    [
        ('現在の版とGitHubの版を比べる', 'サーバーがGitHubの公開版を確認します。この画面の版、公開版、最終確認時刻を表示します。先生のGitHubアカウントは不要です。', 'Compare this page with GitHub', 'The server checks the public GitHub version. View this page\'s version, the public version and the last check time. No teacher GitHub account is needed.'),
        ('公開済みの新しい版に切り替える', 'サーバーに新しい版があれば更新ボタンが出ます。授業・レースを終え、未保存の操作がないことを確認してから押します。', 'Load a newly deployed version', 'When this server has a newer version, an Update button appears. End active lessons or races and confirm that all work is saved before pressing it.'),
        ('GitHubにだけ新しい版がある場合', '「サーバーへの公開待ち」と表示します。管理者による公開が必要です。このボタンでGitHubのソースをサーバーへ自動配備はしません。', 'If only GitHub has a newer version', 'The panel says deployment is pending. An administrator must publish it to the server. This button does not automatically deploy GitHub source.'),
        ('確認できない・開発版と表示された', '通信できない場合は「最新版か未確認」と表示します。接続を確認して再実行してください。公開版より新しい作業版は「開発版」と表示します。', 'If checking fails or says development', 'A connection failure means the latest version is unverified. Check the network and retry. A local version newer than the public release is labelled a development version.'),
    ],
))


def build(language, destination):
    ja = language == 'ja'
    regular, bold = ('JP', 'JPB') if ja else ('EN', 'ENB')
    c = canvas.Canvas(str(destination), pagesize=(595.28, 841.89), pageCompression=1)
    c.setTitle('Aomiyalingo 先生用ガイド' if ja else 'Aomiyalingo Teacher Guide - English')
    c.setAuthor('Aomiyalingo')
    c.setSubject(f'Teacher instructions, Release {RELEASE}, {EDITION}')
    c.setViewerPreference('DisplayDocTitle', 'true')
    c._doc.Catalog.Lang = PDFString('ja-JP' if ja else 'en-US')
    dark, green = HexColor('#3c3c3c'), HexColor('#58cc02')
    for number, (jp, en, steps) in enumerate(PAGES, 1):
        title, subtitle = jp if ja else en
        c.bookmarkPage(f'page-{number}')
        c.addOutlineEntry(title, f'page-{number}', level=0)
        c.setFillColor(green)
        c.roundRect(38, 769, 519, 38, 12, fill=1, stroke=0)
        c.setFillColor(HexColor('#ffffff'))
        c.setFont(bold, 15)
        c.drawString(53, 782, 'Aomiyalingo  |  ' + ('先生用ガイド' if ja else 'Teacher guide'))
        size = 26
        while pdfmetrics.stringWidth(title, bold, size) > 519:
            size -= .5
        assert size >= 21, title
        c.setFillColor(dark)
        c.setFont(bold, size)
        c.drawString(38, 719, title)
        para = Paragraph(escape(subtitle), ParagraphStyle('sub', fontName=regular, fontSize=13.5, leading=20, textColor=HexColor('#666666'), wordWrap='CJK' if ja else None))
        _, height = para.wrap(519, 45)
        assert height <= 40, subtitle
        para.drawOn(c, 38, 689-height)
        for index, row in enumerate(steps):
            head, body = row[:2] if ja else row[2:]
            top = 638-index*135
            c.setFillColor(HexColor('#f3fbe8') if index < 3 else HexColor('#f5f7fa'))
            c.roundRect(38, top-117, 519, 121, 12, fill=1, stroke=0)
            c.setFillColor(green if index < 3 else HexColor('#1cb0f6'))
            c.circle(61, top-19, 15, fill=1, stroke=0)
            c.setFillColor(HexColor('#ffffff'))
            c.setFont(bold, 14)
            c.drawCentredString(61, top-24, str(index+1) if index < 3 else '!')
            font_size = 17.5
            while pdfmetrics.stringWidth(head, bold, font_size) > 451:
                font_size -= .5
            assert font_size >= 15, head
            c.setFillColor(dark)
            c.setFont(bold, font_size)
            c.drawString(87, top-24, head)
            style=ParagraphStyle('body',fontName=regular,fontSize=15.5,leading=22,textColor=dark,wordWrap='CJK' if ja else None)
            p=Paragraph(escape(body),style)
            _, h=p.wrap(485,82)
            assert h<=66,(language,title,head,h)
            p.drawOn(c,53,top-43-h)
        c.setFont(regular,9)
        c.setFillColor(HexColor('#666666'))
        c.drawString(38,38, f'{EDITION}  |  Release {RELEASE}  |  '+('インターネット接続が必要です' if ja else 'Internet connection required'))
        c.drawRightString(557,38,f'{number} / {len(PAGES)}')
        c.setFont(bold,10.5)
        c.setFillColor(HexColor('#168aca'))
        label='先生用ページを開く（クリック）' if ja else 'Open Aomiyalingo (click)'
        c.drawString(38,63,label)
        c.linkURL(BASE,(38,57,300,76),relative=0)
        c.showPage()
    c.save()
    reader=PdfReader(destination)
    assert len(reader.pages)==len(PAGES)
    assert all(len(p.extract_text())>200 for p in reader.pages)
    assert all(any(a.get_object().get('/A',{}).get('/URI')==BASE for a in p.get('/Annots',[])) for p in reader.pages)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--font-dir',type=Path,default=Path('C:/Windows/Fonts'))
    args=parser.parse_args()
    for name,file in [('JP','meiryo.ttc'),('JPB','meiryob.ttc'),('EN','arial.ttf'),('ENB','arialbd.ttf')]:
        pdfmetrics.registerFont(TTFont(name,str(args.font_dir/file),subfontIndex=0))
    out=ROOT/'output/pdf'
    out.mkdir(parents=True,exist_ok=True)
    for lang,name in [('ja','teacher-guide.pdf'),('en','teacher-guide-en.pdf')]:
        dest=out/name
        build(lang,dest)
        shutil.copy2(dest,ROOT/'public/help'/name)
        print(f'{dest}: {len(PAGES)} pages, {dest.stat().st_size} bytes')
