# super-mark · 收藏册

把微信里随手转发收藏的碎片内容（视频号 / 公众号 / 小红书 / B站 / YouTube / GitHub），变成一本**可检索、可分类、可深读**的个人收藏册。

> 你刷到好内容 → 转发到文件传输助手（或 WorkBuddy 任务对话）→ 一个命令解析入库 → 抓音频转文字 → AI 读到「讲者到底说了什么」→ 打开网页端详。

## 它解决什么

| 以前 | 现在 |
| --- | --- |
| 只有一条平铺的时间线，无分类无标题 | 96 条收藏自动归到 10 个主题，每条有标题、摘要、要点 |
| 想找「那条讲低频质感的视频」只能靠记忆翻记录 | 全文搜索（标题/摘要/要点/原文/标签）+ 分类与标签筛选 |
| 不知道自己收藏了什么、集中在哪里 | 洞察页：收藏节奏、注意力分布、星期×小时热力图、可行动清单 |
| **AI 只读了标题和简介，等于没看** | **抓音频 → 转文字 → 读出核心论点/方法步骤/具体数据/可落地结论** |
| 收藏 = 吃灰 | 每条标注「可做」，配一个具体动作提示，读完可打勾 |

## 分析与深读管线

```
链接 ──fetch──▶ media/<id>.mp3 ──transcribe──▶ transcripts.json ──deep──▶ deep.json
            yt-dlp 下载→抽音轨      本地 ASR          文字稿           深度解读
            inbox 录屏兜底
```

- **抓取/转写引擎已抽离为独立 skill [`iskill-media-transcribe`](../iskill-media-transcribe/)**（super-mark 通过 `lib/engine.mjs` 动态加载，路径可用 `MEDIA_TRANSCRIBE_HOME` 覆盖）。
- **`fetch`**：yt-dlp 下载视频（含 `yt-dlp-patch` 插件，视频号走元宝桥接，自动识别 sph 链接）→ ffmpeg 抽音轨 → mp4 抽完即删（`--keep-video` 可保留到 `media/video/`）→ `inbox/` 手工投放录屏仍是最稳兜底。
- **`transcribe`**：VoiceBox 本地 Whisper（MCP `audio_path` 直读本地文件）为主；装了 whisper CLI（mlx-whisper）则自动优先、产出逐句时间戳。音频全程不出机器。
- **`deep`**：把转写稿喂给 AI，产出「核心论点 / 方法步骤 / 关键信息 / 可落地的结论 / 局限与保留 / 与已有收藏的关联」，渲染进详情页。

> 视频号链接需要元宝(tencent.com)登录态 cookie；抓不到时**最稳的路是录屏丢进 `inbox/`**，零依赖零授权。详见 `SKILL.md`。

## 快速开始

```bash
# 1. 初始化一个实例
node scripts/mark.mjs init ~/WorkBuddy/SuperMark

# 2. 导入微信聊天记录（把转发内容导出的 txt，或直接粘贴）
node scripts/mark.mjs ingest ~/WorkBuddy/SuperMark --file chat.txt --year 2026

# 3. 分析：输出待分析清单与提示词（由 AI 逐条产出 JSON）
node scripts/mark.mjs analyze ~/WorkBuddy/SuperMark --limit 40
#    → 助手写回 data/incoming-1.json
node scripts/mark.mjs analyze ~/WorkBuddy/SuperMark --apply data/incoming-1.json

# 4.（可选，但这是深度的来源）抓音频 → 转写 → 深读
node scripts/mark.mjs fetch      ~/WorkBuddy/SuperMark --limit 5
node scripts/mark.mjs transcribe ~/WorkBuddy/SuperMark --limit 3
node scripts/mark.mjs deep       ~/WorkBuddy/SuperMark --limit 6
node scripts/mark.mjs deep       ~/WorkBuddy/SuperMark --apply data/deep-1.json

# 5. 构建运行时数据 + 预览
node scripts/mark.mjs build   ~/WorkBuddy/SuperMark
node scripts/mark.mjs preview ~/WorkBuddy/SuperMark

# 本机能力体检（接手时先跑一次）
node scripts/mark.mjs caps
```

在 WorkBuddy 里直接说意图即可：「把我这段聊天记录入库」「分析新收藏的」「把这几条视频转文字深读」「打开预览」。

## 视图

- **时间流**：Hero 渐变 + 居中搜索 + 精选 4 条海报行，下面是 4 列 2:3 竖版海报网格；可切「列表」模式逐行扫读
- **主题**：按一级分类聚合 + 标签云（点标签直接筛选）
- **洞察**：收藏节奏柱状图、分类占比环形图、星期×小时热力图、价值类型与来源构成、待办清单
- **详情**：编号 + 分类色标题区 → AI 摘要 → 编号要点 → 行动提示 → **深度解读** → 转发原文 → **音频转写全文（可展开）** → 状态/评分/笔记

## 设计定调

**版式语言照搬 Netflix Media Center（media.netflix.com），配色换成自己的暖黑 + 朱砂。**

全幅渐变 Hero（居中大标题 + 居中搜索）→ 精选海报行压在渐变下缘 → 带强调色片段的栏目标题 + 规则线 → 描边胶囊筛选 → 4 列 **2:3 竖版、直角、无阴影**的海报网格（下方只跟一行灰字）。

**海报是生成的**：条目没有图片，所以把排版当海报——分类色相 + 按 id 哈希的色相抖动做渐变底，叠一层由 id 决定的几何母题，标题用宋体按字数分档排版。同一条内容永远得到同一张海报。

字体分工：UI 走 `PingFang SC` 粗体（Netflix Sans 的中文对应），海报标题走 `Songti SC` 宋体，数字走 `SF Mono` 等宽。全系统字体栈，零网络依赖。

## 技术选择

- **技术栈 v2**：React 19 + Tailwind CSS 4 + Motion 13 + Vite 8 + vite-plugin-pwa（均最新版）；vanilla 版保留在 tag `v1.0.0-vanilla`。图表仍为手写 SVG，零图表库依赖
- **PWA**：manifest + 程序化生成的全套图标（192/512/maskable/apple-touch-icon）+ Service Worker（壳预缓存 + 数据 SWR + 音频 CacheFirst）+ 版本更新感知（`build-info.json` 指纹比对 → 可关闭的底部轻提示 → 三步法强刷）。配方来自 [`iskill-pwa-guideline`](../iskill-pwa-guideline/)
- **需 http 部署**：ES module 在 `file://` 下被 CORS 拦，v2 起不支持双击打开；数据仍以 `window.SUPERMARK_DATA` 注入（`data/marks.js`，不参与打包指纹），标注走 localStorage（IndexedDB 可用时自动升级）
- **不用 wa-sqlite / OPFS**：静态托管设不了 COOP/COEP 头，而本场景写入极轻
- **四层数据全部增量、只增不改**：`raw.json`（原文）→ `transcripts.json`（转写稿）→ `enrich.json`（分类打标）→ `deep.json`（深度解读）。重跑任何一层都不丢数据、不重跑已完成的条目
- **音频不出机器**：转写默认走本地引擎（VoiceStudio / mlx-whisper）

## 目录结构

```
scripts/mark.mjs                CLI 入口（init/ingest/add/analyze/fetch/transcribe/deep/build/report/preview/caps）
scripts/lib/
  parse-wechat.mjs              微信聊天记录解析
  platform.mjs                  平台识别
  dedupe.mjs                    去重键与增量合并
  taxonomy.mjs                  分类体系
  build.mjs                     合并四层数据 → 运行时产物
  audio.mjs                     适配层：inbox 认领 / 按 id 命名 mp3（引擎在 iskill-media-transcribe）
  asr.mjs                       适配层：转发引擎转写（VoiceBox / whisper CLI）
  engine.mjs                    引擎加载器（MEDIA_TRANSCRIBE_HOME 或兄弟目录）
app/                            Web App 模板（init 时拷进实例；含 manifest/sw.js/icons/pwa.js）
docs/requirements.md            需求规格
examples/wechat-sample.txt      真实样本（96 条）
```

数据模型、分类体系、analyze/deep 的执行约定、视觉定调，见 `SKILL.md`。

> 依赖同步：本仓库含 iskill 共享真源的 vendored 副本（清单见 `package.json` 的 `iskillDeps`），**不要手改**。使用前请同时安装 iskill-dep-sync：对 agent 说「请帮我安装 Skill：aispin/iskill-dep-sync」；用法见 SKILL.md「依赖同步」节。
