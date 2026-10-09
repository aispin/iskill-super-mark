---
name: iskill-super-mark
description: 把微信（视频号/公众号）里随手转发收藏的内容，变成一本可检索、可分类、有洞察的个人「收藏册」网页应用。提供 init/ingest/add/analyze/build/report/preview/fetch/transcribe/deep/caps 十一个命令：初始化实例、批量导入聊天记录、单条追加、AI 分类打标、生成运行时数据、控制台摘要、本地预览、抓取视频音频（yt-dlp + 视频号插件，转 mp3）、本地语音转写（VoiceBox / whisper）、基于转写稿的深度解读、能力体检。交付物是零外部依赖的纯静态站点（版式照搬 Netflix Media Center：渐变 Hero + 精选海报行 + 4 列 2:3 竖版海报网格；手机优先、file:// 双击即开；http 部署时支持 PWA 安装/离线/更新感知）。当用户说「整理我收藏的微信内容」「把转发的视频号做个知识库」「收藏册」「super mark」「分析我转发的链接」「把视频转成文字再分析」时使用。
agent_created: true
---

# super-mark · 收藏册

把「微信里随手转发的碎片内容」变成「可检索、可分类、可回看、有洞察的私人知识库」。

**核心设计：事实层与分析层分离。** `raw.json`（原文）→ `transcripts.json`（音频转写稿）→ `enrich.json`（分类打标）→ `deep.json`（深度解读），每一层都按 id 增量累积、只增不改；用户标注存在浏览器本地。重跑任何一层都不会丢数据，也不会重跑已完成的条目。

**分析深度的分水岭**：只看标题和描述，AI 只能复述；**有了音频转写稿，才能读出讲者的真实论点、方法步骤、具体数据**。所以 `fetch → transcribe → deep` 这条链是本 skill 的核心能力，不是可选项。

## 何时用
- 用户把微信聊天记录（转发到文件传输助手/WorkBuddy 任务对话的）丢过来，想整理归类。
- 用户想可视化看看「我到底收藏了什么、集中在哪些主题、哪些是真正有用的」。
- 用户转发单条链接/想法，想随手入库。

## 交付物结构（一个「实例」目录）
App 模板是 **Vite 工程**（React 19 + Tailwind CSS 4 + Motion 13 + vite-plugin-pwa），源码在仓库 `app/`，构建产物落到实例根目录：
```
<实例>/
  index.html            Vite 构建产物（hash 路由 SPA；需 http 部署，file:// 不再支持）
  assets/               构建出的 js/css（带内容指纹）
  icons/                PWA 图标（模板 public/icons 原样拷出）
  manifest.webmanifest  PWA 清单（vite-plugin-pwa 生成）
  sw.js + workbox-*.js  Service Worker（壳预缓存 + 数据 SWR）
  data/
    raw.json            事实层：解析后的原始条目（只增不改）
    transcripts.json    事实层扩展：音频转写稿（按 id，逐条落盘）
    enrich.json         分析层：AI 产出的分类打标（按 id 增量）
    deep.json           分析层扩展：基于转写稿的深度解读（按 id 增量）
    pending.json        analyze 导出的待分析清单
    pending-deep.json   deep 导出的待深读清单（含转写稿全文）
    taxonomy.json       分类体系（可手工编辑；空数组=用默认）
    marks.js            运行时数据 window.SUPERMARK_DATA（build 产物）
    marks.json          同上，交换/导出用
    stats.js            预聚合统计 window.SUPERMARK_STATS
    build-info.json     版本指纹（build 产物，PWA 更新感知用）
  media/                抓到的音频（<id>.mp3），深度分析的事实来源
  inbox/                手工投放区：录屏/下载的 mp4 放这里，fetch 会自动认领
```

## 在 WorkBuddy 聊天窗口中调用（重要）
本 skill 以 `/iskill-super-mark` 形式加载，命令是 `scripts/mark.mjs` 的 CLI 子命令，**由助手代为执行**，用户无需打开终端。

**两种调用方式：**
1. **自然语言**：「帮我把这段聊天记录入库」「分析一下新收藏的」「打开预览」——助手读本文件并执行对应命令。
2. **斜杠带参**：`/iskill-super-mark ingest ~/WorkBuddy/SuperMark --file xxx.txt`，把第一个词当作子命令，其余作为参数，执行：
   ```
   node "<SKILL_DIR>/scripts/mark.mjs" <子命令> <其余参数>
   ```
   `<SKILL_DIR>` 为包含本 SKILL.md 的目录（从已加载的 SKILL.md 路径推导）。

**意图 → 子命令映射：**

| 用户说 | 子命令 |
| --- | --- |
| 初始化 / 新建一个收藏册 | `init <dir>` |
| 导入 / 入库 / 解析这段聊天记录 | `ingest <dir> --file <txt>`（或 `--stdin`） |
| 记一条 / 加这条链接 | `add <dir> "<内容>"` |
| 分析 / 分类 / 打标 | `analyze <dir>` |
| 深读 / 深入分析 / 这条视频讲了什么 | `deep <dir>` |
| 抓音频 / 把视频转成语音 | `fetch <dir>` |
| 转文字 / 听写 / 转写 | `transcribe <dir>` |
| 本机能不能抓/能不能转写 | `caps` |
| 构建 / 生成页面数据 / 刷新 | `build <dir>` |
| 看看现在多少条 / 还有多少没分析 | `report <dir>` |
| 预览 / 打开看看 | `preview <dir>` |

**务必使用本 skill 目录下 `scripts/mark.mjs` 的绝对路径**，运行后向用户报告执行的命令与结果。

## analyze 的执行约定（核心）
`analyze` 分两步，**语义分类由对话中的助手完成**，脚本只管挑条目、出提示词、校验回填：

1. 跑 `analyze <dir>`（可加 `--limit N`，默认 40）→ 输出提示词 + 待分析清单（同时写入 `data/pending.json`）。
2. **助手逐条产出 JSON**（字段见下），写入 `<实例>/data/incoming-N.json`（每批 20–30 条，避免单次输出过长）。
3. 跑 `analyze <dir> --apply <incoming-N.json>` 合并进 `enrich.json`；多批就多次 `--apply`。
4. 全部完成后 `build <dir>`。

**每条产出的字段：**
```json
{"id":"...","title":"≤14字","summary":"1-2句","keyPoints":["2-4条，可执行优先"],
 "category":"分类id","subCategory":"自由填写","tags":["≤5个具体名词"],
 "audience":["self|family|kids|parents|work"],"valueType":"tutorial|insight|tool|inspiration|news|life|fun",
 "actionable":true,"actionHint":"看完能做的那个动作","confidence":0.9}
```
规范：
- `category` 必须取 `taxonomy.json` 里已有的 id（默认：ai / media / music / parenting / health / mac / life / business / english / other）。确需新增分类时先告知用户，再写进 taxonomy.json。
- 无文案、只有链接的条目：`title` 写「（仅链接）」，`confidence` ≤ 0.4，提醒用户回看原内容。
- 医疗/投资类观点保持中立表述，必要时加「不构成建议」。
- `confidence` < 0.6 的条目会进 report 的「建议复核」。

## 深度分析管线：fetch → transcribe → deep（核心能力）

只看标题和描述，AI 只能复述；**只有拿到音频转写稿，才能做真正的深读**。所以对视频类收藏，标准流程是三层递进。

### 1. `fetch <dir>` — 拿到音频

抓取/转写引擎已抽离为独立 skill **`iskill-media-transcribe`**（`lib/engine.mjs` 动态加载，`MEDIA_TRANSCRIBE_HOME` 可覆盖路径）。按可靠性降级：

| 层级 | 手段 | 适用 |
| --- | --- | --- |
| 0 | `inbox/` 手工投放 | 用户已把录屏 mp4 丢进 `inbox/`（文件名以条目 id 开头即可），自动认领并抽音轨 |
| 1 | yt-dlp 下载视频 → ffmpeg 抽音轨 | YouTube / B站 / 小红书 / 抖音 / 西瓜等；mp4 默认抽完即删（`--keep-video` 保留到 `media/video/`） |
| 2 | 带登录态 cookies | 视频号需要元宝(tencent.com)会话：`--cookies <cookies.txt>`；sph 链接自动走 `--weixin`（`WEIXIN_COOKIE_FILE`，默认 `./weixin_cookies.txt`） |

> 原实现的"浏览器嗅探直链"已随引擎抽离移除：对视频号(blob:)零价值且曾把整批抓取带崩；其它平台失败时走 inbox 兜底即可。

**微信视频号（`weixin.qq.com/sph/*`）的音频获取，两条路（务必跟用户说清楚，登录态那步必须由用户本人完成）：**

- **路线 A：元宝登录态 cookie（最省事，需用户登录一次）**
  - 已装 `yt-dlp-patch` 插件（提供 `wppilot:channels` 提取器），解析走**元宝桥接**（`yuanbao.tencent.com`），`wx.qq.com` 网页版登录无效。
  - 用户在 Chrome 登录 `https://yuanbao.tencent.com`（微信扫码）后导出 cookie：
    `yt-dlp --cookies-from-browser chrome --cookies weixin_cookies.txt https://example.com`
  - 然后 `fetch --cookies weixin_cookies.txt`（或把该文件设为 `WEIXIN_COOKIE_FILE`，sph 链接自动使用）。
  - 桥接偶发 400 已由引擎的 8 次退避重试 + 批量错峰兜住；若仍失败退回路线 B。
- **路线 B（最稳，强烈推荐）：录屏丢 `inbox/`**
  - 内容本来就在微信里，让用户把视频录屏（iOS 控制中心录屏 / QuickTime / OBS）成 mp4，**文件名以条目 id 开头**放进 `inbox/`，再跑 `fetch`（自动认领并抽音轨）。零依赖、零授权、成功率最高。

参数：`--id <id>` 单条 ｜ `--limit N` ｜ `--all` 含已有 ｜ `--force` 重抓 ｜
`--file <mp4> --id <id>` 手工投放 ｜ `--cookies-from-browser chrome` ｜ `--cookies <file>`

### 2. `transcribe <dir>` — mp3 → 文字稿

引擎在 iskill-media-transcribe 内维护，按「本机已有即用」自动探测，全程离线，音频不出机器：

1. **whisper CLI（装有则首选，产出逐句时间戳）**——`mlx-whisper`（Apple Silicon 最快，中文好）／`whisper.cpp`／openai-whisper。
2. **VoiceBox 本地服务（无 whisper CLI 时的主力，中文效果好）**——`/Applications/Voicebox.app`，MCP（Streamable HTTP，`http://127.0.0.1:17493/mcp`）暴露 `voicebox.transcribe`。
   - 底层是本地 Whisper（默认 `turbo` 模型，可用 `VOICEBOX_MODEL` 改 `base|small|medium|large`），**中文原生支持**。
   - 调 `voicebox.transcribe` 时直接传 `audio_path`（本地绝对路径），**不上传、无大小上限之忧**。
   - **已知限制（实测确认）：其 MCP 只回纯文本，无 segments/words 时间戳** → 此时 `transcripts.json` 的 `subtitleTimed` 为 `false`（srt 只能整段单块）。
3. **VoiceStudio 本地 MCP**（`http://localhost:3900/mcp`）—— **仅英文兜底**：实测默认引擎是英文模型、`language` 参数被忽略，中文不稳。

参数：`--id` ｜ `--limit N`（默认 3，转写慢，别一次太多）｜ `--redo` ｜ `--lang zh` ｜ `--engine voicebox|whisper|voicestudio`

结果逐条写入 `data/transcripts.json`，中断不丢已完成的；每条含 `subtitleTimed` 标记。

### 3. `deep <dir>` — 基于转写稿产出深度解读

和 `analyze` 一样是「脚本出清单 + 提示词，助手产出 JSON 回填」：

1. `deep <dir>`（`--limit 6`，`--chars 7000` 控制每条塞进上下文的转写稿长度）→ 输出提示词 + 待深读清单（含转写稿全文，写入 `data/pending-deep.json`）。
2. **助手逐条产出 JSON** 写入 `<实例>/data/deep-N.json`。
3. `deep <dir> --apply <deep-N.json>` 合并进 `deep.json`，然后 `build <dir>`。

**每条深读的字段（与 analyze 刻意区分开，不重复标题/摘要）：**
```json
{"id":"...",
 "thesis":"核心论点（不是「介绍了…」，要说出讲者到底主张什么）",
 "steps":["方法/流程，2-6 条能照着做的"],
 "facts":["稿子里出现的具体数字、工具名、书名、案例"],
 "takeaway":"对我最有价值的一条结论，具体、可执行、能改变做法",
 "caveats":["讲者的前提假设、过时之处、我不同意的地方"],
 "related":["与这批收藏里其它条目的关联（写清和哪条、什么关系）"]}
```
铁律：**只依据转写稿，禁止脑补稿子里没有的信息**；转写可能有识别错误，按上下文合理理解但不编造事实。这些会渲染进详情页的「深度解读」区块。

### 能力自检

`caps` 一条命令体检全链路（引擎 iskill-media-transcribe 的路径 / yt-dlp / 视频号插件 / ffmpeg / VoiceBox / whisper CLI），并给出「现在能做到哪一步」的结论。**接手实例时先跑一次。**

## 分类体系（默认 taxonomy）
| id | 名称 | id | 名称 |
| --- | --- | --- | --- |
| ai | AI 与编程 | mac | 效率与 Mac |
| media | 自媒体与内容 | life | 生活方式 |
| music | 音乐制作 | business | 商业与认知 |
| parenting | 育儿与家庭 | english | 英语学习 |
| health | 健康养生 | other | 其他待归类 |

编辑 `data/taxonomy.json` 可覆盖或新增（写空数组 = 用默认）。

## Web App 视觉定调（改动样式前先读这段）
**方向：版式语言照搬 Netflix Media Center（media.netflix.com），配色换成自己的暖黑 + 朱砂。**

照搬的是这五条骨架，别改：
1. **顶栏**：纯色深色条（`--bar`），左侧品牌（色块 + 站名 + 等宽英文名），右侧文本导航 + **一个实心强调色按钮**（对应 Netflix 的 Apply，本 App 是「▶ 可做 N」，一键跳到可行动项）。
2. **全幅渐变 Hero**：两团大径向光叠一层线性渐变（`--hero-1/2/3`），**居中大标题 + 居中搜索框**；最新 4 条做成**精选海报行**，压在渐变的下缘。非首页/已筛选时切 `.hero.compact` 收起大标题与精选行。
3. **栏目标题**：`我收藏的主题 · <span class="accent">10 类</span>` 这种「白字 + 强调色片段」的句式，下方一条 `--accent-dim` 规则线。
4. **胶囊筛选**：圆角描边胶囊（`.pill`），激活态填充强调色；移动端两行各自单行横滑，别让它吃掉首屏。
5. **海报网格**：4 列（平板 3 列 / 移动 2 列）。**海报是 2:3 竖版、直角、无阴影、无边框**，下方只跟一行灰字 `分类 · 日期`，像 Netflix 海报只跟一行日期。

**海报怎么来的（关键）**：我们的条目没有图片，所以**把排版当海报**——`posterVars(id, cat)` 以分类色相为家族、按 id 哈希抖动 ±14° 色相生成 `--p1/--p2` 渐变底，叠一层由 id 决定的几何母题（`data-p` 0-5：大圆 / 同心环 / 斜纹 / 扇形 / 网点 / 对角带，颜色 `--pm`），底部压暗保证标题可读，标题用**宋体**排版、字号按字数分五档（`titleSize()`）。同一条内容永远得到同一张海报。

**字体分工**：UI 骨架（顶栏 / Hero 大标题 / 栏目标题 / 按钮）走 **PingFang SC 粗体**（Netflix Sans 的中文对应）；**海报标题走宋体**（海报是「作品」，字体可以跳出来）；数字与元信息走 **SF Mono 等宽 + `tabular-nums`**。全系统字体栈、零网络依赖，禁用 Inter/Roboto/system-ui 作展示字。

**配色**：底 `#12100d`、条 `#0b0a08`、面 `#1a1712`、字 `#f4efe4`、弱 `#9b9284`，唯一强调色朱砂 `#ff5a2b`（只给关键动作）。分类色由 `SM.catColor()` **按主题重新配平**（暗色提亮到 L≈56-68，浅色压到 L≈27-42），所以加新分类只需在 taxonomy 里给一个基础色相，两套主题自动成立。

**动效**：克制。一次错峰淡入（`--i` × 55ms，≤12 组），切筛选不重放；hover 是海报上浮 4px + 阴影，不是发亮。`prefers-reduced-motion` 下全关。

**反 AI 味红线**：不要三张一样圆角特性卡、不要白底紫渐变、不要无表情的统一圆角 + 统一阴影、不要通用线性图标装饰。**所有卡片直角、无阴影**是本方向最容易崩的一处。

## 存储方案（已调研，勿轻易推翻）
**不引入 wa-sqlite / OPFS。** 理由：
- 官方 sqlite-wasm 的 `opfs` VFS 需要 COOP/COEP 跨源隔离响应头，纯静态托管设不了；`opfs-sahpool` 必须跑 Worker 且不支持多标签页并发，`file://` 不可用。
- 本场景是「离线批量产出只读数据 + 用户少量标注」，写入极轻，SQLite 的事务与大表能力用不上。
- 数据量按 100 条/月估算，一年约 1200 条、文本 < 2MB，前端内存过滤毫秒级。

因此：数据以 `window.SUPERMARK_DATA = {...}` 的 `.js` 形式注入（规避 `file://` 下 fetch 的 CORS 限制），用户标注走 localStorage（file:// 亦可用），IndexedDB 可用时自动升级并迁移。未来若数据量过万或需要复杂查询，再在 Worker 内挂 `sqlite-wasm` 的 `opfs-sahpool`，SQL 层无需重设计。

## App 技术栈 v2（React + Tailwind + Vite + Motion + PWA）
2026-09 起 app 模板从 vanilla JS 升级为 Vite 工程（vanilla 版保留在 tag `v1.0.0-vanilla`）：

- **栈**：React 19.3 / Tailwind CSS 4.3（`@tailwindcss/vite`，主题变量在 `src/index.css` 的 `@theme`，`[data-theme=dark]` 覆盖同名变量）/ Motion 13（`motion/react` 入场错峰与 Toast 动效）/ Vite 8.3 / vite-plugin-pwa 1.3。
- **源码**：仓库 `app/`（`src/lib/` 数据·存储·筛选·PWA，`src/components/` 视图组件，图表仍为手写 SVG 零依赖）。数据契约不变：`window.SUPERMARK_DATA`（`data/marks.js` 以普通 `<script>` 注入，不参与打包指纹）。
- **重建实例**：
  ```
  cd <实例>/app && npm install
  DATA_ROOT=<实例根> OUT_DIR=<实例根> npx vite build
  ```
  产物直接落实例根（`emptyOutDir: false`，不碰 data/、media/）。dev 模式（`npm run dev`）由内置中间件把 `<DATA_ROOT>/data`、`/media` 映射到 dev server。
- **注意**：ES module 在 `file://` 下被 CORS 拦，**v2 起 `file://` 双击打开不再支持**，一律走 http 预览/托管。

## PWA 支持（vite-plugin-pwa，http 部署生效）
- **manifest.webmanifest**：vite.config 内联配置（standalone / zh-CN / 朱砂主题色，相对根 `start_url`/`scope`）。
- **app/public/icons/**：`icon.svg` 朱砂印源图 + `generate-icons.mjs` 程序化生成 PNG（192 / 512 / maskable-512 / apple-touch-icon-180）。图形主体占 62.5%，天然满足 maskable 80% 安全区。
- **SW（generateSW）**：应用壳预缓存（html/js/css/图标，globIgnores 排除 data/media）；`data/marks.js` 走 StaleWhileRevalidate（离线可读、后台拉新）；音频走 CacheFirst（带 rangeRequests）；**`data/build-info.json` 走 NetworkFirst**（版本指纹必须永远新鲜，避免「先旧后新」）。
- **更新感知（src/lib/pwa.jsx）**：SW 注册带协议守卫（`/^https?:$/`，非 http 静默跳过）；SW 新版本 `onNeedRefresh`；启动时 `fetch('data/build-info.json', {cache:'no-store'})` 与 localStorage 记住的 builtAt 比对，变化则亮**可关闭的底部轻提示**（Motion 进出场），点「刷新」走三步法（清全部 Cache Storage → 注销 SW → reload）——不清运行时缓存的话 marks.js 旧数据会残留。

**给实例补 PWA 的步骤**：实例 `app/` 里 `npm install` + `DATA_ROOT/OUT_DIR` 双环境变量 build → http 预览验证 `sw.js`/`manifest.webmanifest` 均 200。iOS 安装 = Safari 分享菜单「添加到主屏幕」（无 beforeinstallprompt，靠 apple-touch-icon + apple-meta 出图标）。

## 隐私
全部数据留在本地：实例目录 + 浏览器本地存储，无后端、无埋点、无外链请求（除用户主动点「打开原内容」跳转微信）。不上传任何内容到第三方；若将来接 ima 同步，凭证放 `~/.workbuddy/iskill-super-mark/config.json` 并加入 .gitignore，绝不进仓库。

## 依赖同步

本仓库 `promo-page/assets/{app.js,style.css,icons.js}` 是 [iskill-promo-page](https://github.com/aispin/iskill-promo-page)
模板引擎的 vendored 副本（锁定版本见 `package.json` 的 `iskillDeps`），**不要手改**——
去真源仓库改并升 `@iskill-version`，再用 iskill-dep-sync 同步回来。本机未装该工具时，先安装：对 agent 说「请帮我安装 Skill：aispin/iskill-dep-sync」，或按下方自举命令现场拉取：

```bash
T="$HOME/.workbuddy/skills/iskill-dep-sync/scripts/skill-deps.mjs"
[ -f "$T" ] || { TMP="$(mktemp -d)"; curl -fsSL "https://raw.githubusercontent.com/aispin/iskill-dep-sync/HEAD/scripts/skill-deps.mjs" -o "$TMP/skill-deps.mjs"; T="$TMP/skill-deps.mjs"; }
node "$T" check "$(pwd)"     # 漂移检测；node "$T" sync "$(pwd)" 恢复/升级；node "$T" env "$(pwd)" 冷启动自检
```
