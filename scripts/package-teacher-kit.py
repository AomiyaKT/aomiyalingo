"""Build the small, credential-free online teacher starter ZIP."""
from pathlib import Path
import re
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
version = re.search(r"APP_VERSION = '([^']+)'", (root / 'public/shared/release.js').read_text(encoding='utf-8')).group(1)
url = 'https://aomiyalingo.minamiyakk.chatgpt.site/'
launcher = f'''<!doctype html>
<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aomiyalingo · Start here / ここから開始</title>
<style>body{{font:20px/1.7 Arial,Meiryo,sans-serif;color:#3c3c3c;max-width:760px;margin:48px auto;padding:24px}}h1{{color:#58a700}}a{{display:block;padding:20px;margin:18px 0;border:2px solid #e5e5e5;border-bottom-width:5px;border-radius:16px;color:#1899d6;text-decoration:none;font-weight:bold}}a:first-of-type{{background:#58cc02;border-color:#58a700;color:#fff;text-align:center}}small{{display:block;font-size:16px}}</style>
<h1>Aomiyalingo</h1><p>先生用 / For teachers · Release {version}</p>
<a href="{url}">先生のホームを開く<br>OPEN TEACHER HOME</a>
<a href="Teacher-Guide-Japanese.pdf">日本語の説明書 / Japanese guide (PDF)</a>
<a href="Teacher-Guide-English.pdf">英語の説明書 / English guide (PDF)</a>
<p>先生のパソコンと生徒のiPadは、インターネット接続が必要です。先生用パスワードでログインし、授業画面のQRを生徒に見せてください。</p>
<p>Connect the teacher computer and student iPads to the internet. Sign in with your teacher password, then show students the QR code in the lesson screen.</p>
<small>追加ソフトは不要です。パスワード・成績は含みません。<br>No additional software needed. Passwords and student records are not included.</small></html>'''
instructions = '''Aomiyalingo — 先生用 / Teacher starter kit

1. ZIPを展開します。/ Extract this ZIP.
2. START-HERE.htmlをダブルクリックします。/ Double-click START-HERE.html.
3. 緑のボタンから先生のホームを開きます。/ Use the green button to open Teacher Home.

インターネット接続と先生用パスワードが必要です。
Internet access and a teacher password are required.
このZIPはオンライン版の入口と日英PDFです。オフライン版サーバーではありません。
This ZIP contains an online launcher and Japanese/English PDF guides. It is not an offline server.
'''
output = root / 'downloads/Aomiyalingo-Teacher-Kit.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    archive.writestr('Aomiyalingo/START-HERE.html', launcher)
    archive.writestr('Aomiyalingo/READ-ME.txt', instructions.encode('utf-8-sig'))
    for source, name in [('teacher-guide.pdf', 'Teacher-Guide-Japanese.pdf'), ('teacher-guide-en.pdf', 'Teacher-Guide-English.pdf')]:
        archive.write(root / 'public/help' / source, 'Aomiyalingo/' + name)
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert len(archive.infolist()) == 4
print(f'{output.name}: {output.stat().st_size} bytes; launcher and two guides verified.')
