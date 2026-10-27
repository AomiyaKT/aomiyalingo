# Aomiyalingo

English practice and multiplayer word races for Japanese elementary classrooms. Teachers manage lessons on a Windows computer; students scan a QR code with their iPads.

**Current version: Release 74 · 27 October 2026**  
[Open the app](https://aomiyalingo.minamiyakk.chatgpt.site/) · [更新记录 / Changelog](CHANGELOG.md) · [Release 74 details](docs/release-74.md)

## 目前包含什么

- 五年级 Unit 1–8、六年级 Pre Unit–Unit 8，附图片、发音音频和例句；五年级共 159 个词条。
- 默认日语，齿轮里可切换英文；老师登录后选择单词练习或竞速游戏。
- 十种练习题型：词义选择、听音选词、字母拼写、词语配对、连词成句、句子填空、听音配对、听音连词成句、听力填空、听写。
- 单词练习支持分段学习、自适应提示、错题复习、保存进度和详细记录。
- 竞速包含三站，默认每站六分钟无尽答题，学生题序分别随机；支持头像、准备、中途加入、道具、连击、实时排名和每站前三名。
- 老师可暂停、结束、重设赛事、管理加入、查看错题、导出 CSV，以及删除或恢复记录。
- 教材检查、教材/规则/自制音频 JSON 备份与恢复、完整项目 ZIP 脚本。

## 最近更新

Release 72 补齐五年级全单元和素材；Release 73 优化老师端刷新和渲染；Release 74 加入学生端增量同步、下一题素材预取、按阶段精简的老师界面、教材检查及备份恢复。完整说明见 [CHANGELOG.md](CHANGELOG.md)。

## 验证结果

- 75 组回归测试通过。
- 17 组教材配置 / 387 条配置记录检查通过，0 错误、0 警告（包含旧版兼容配置，并非 387 个不重复单词）。
- 35 名学生、加速模拟 30 分钟课堂，30,452 次请求、3,209 次竞速答题、200 次重试回放，0 意外错误。
- 长测使用本地 Worker API 和 SQLite；尚不能替代实体 iPad、学校 Wi-Fi 或帧率实测。

## Development

Use Node.js 24 LTS and npm. The local preview uses Node's built-in SQLite support.

```sh
npm ci
npm run check
npm run content:check
```

Set a local teacher password and start the temporary preview in PowerShell:

```powershell
$env:TEACHER_PASSWORD = 'choose-a-local-preview-password'
node dev.mjs
```

Open http://127.0.0.1:8767/. Preview records disappear when the process stops.

```sh
npm run build
npm run backup:project
node --expose-gc scripts/soak-classroom.mjs --output .sites-runtime/soak.json
```

The hosted app uses a Cloudflare Worker and a persistent D1 database bound as `DB`. Set `TEACHER_PASSWORD` through the hosting provider's secret settings. Apply migrations in `drizzle/` in order. Build output is `dist/server/index.js`.

The existing deployment identity is retained in `.openai/hosting.json`. Uploading to GitHub does not redeploy the app, transfer the production database, or create an offline server. A separate hosted instance needs its own hosting identity, database and secrets. Teachers using the hosted app need only a browser and internet access.

## Project layout

| Path | Purpose |
| --- | --- |
| `public/` | Browser UI, localization, fonts, pictures and audio |
| `server/` | Classroom, race, editor and storage logic |
| `db/`, `drizzle/` | Database schema and migrations |
| `tests/`, `scripts/` | Regression checks, benchmarks, classroom rehearsal and backup tools |
| `public/help/teacher-guide.pdf` | Japanese teacher guide |
| `ARCHITECTURE.md`, `docs/` | Architecture, release notes and earlier development notes |

## Source and privacy

Application snapshot: `b6fd2f22d5c7d96d20e3bdec46022a5447a51a2b` (interface Release 74). Hosting version numbers are separate from interface release numbers. Earlier development notes are preserved in `docs/project-history.md`.

Production student records, attendance exports, passwords, dependency folders, build output, runtime caches and temporary packages are excluded. Teaching JSON backups exclude student results and passwords; use CSV for results. Built-in media remain in this repository.

This is a private project backup. Bundled third-party media retain their original rights; this repository does not grant a separate redistribution license for those assets.
