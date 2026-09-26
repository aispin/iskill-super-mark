# super-mark · 需求规格说明书（v0.1，待确认）

> 一句话：**把「微信里随手转发的碎片内容」变成「可检索、可分类、可回看、有洞察的私人知识库」。**
> 本文档是开发前的对齐稿，确认后再写代码。

---

## 1. 背景与痛点

| 现状（As-is） | 问题 |
| --- | --- |
| 刷微信视频号/文章，遇到好内容 → 转发到「文件传输助手」当书签 | 只有一条平铺的时间线，无分类、无标题、无摘要 |
| 想回头找「那条讲编曲低频质感的视频」 | 只能靠记忆翻聊天记录，基本找不到 |
| 收藏了 100+ 条 | 完全不知道自己收藏了什么、集中在哪里、哪些是真正有用的 |
| 有一些自己随手记的想法（纯文本，无链接） | 混在转发内容里，同样无法管理 |

**To-be：**
1. 微信内容可以直接转发到 WorkBuddy 的任务对话 → 由 skill 自动解析入库。
2. 一个命令完成「解析 → 去重 → AI 分类打标 → 结构化数据」。
3. 一个手机优先的 Web App 可视化呈现：时间流、主题分类、标签云、统计洞察。
4. 本地优先、零后端、可发布为在线链接随时访问。

---

## 2. 数据流总览

```
微信转发内容（聊天记录 / 单条链接 / 文本）
        │
        ▼  ① ingest：解析、去重、抽取字段
   data/raw.json          ← 原始条目（事实层，永不覆盖）
        │
        ▼  ② analyze：AI 语义分析（分类/标签/摘要/价值）
   data/enrich.json       ← 分析结果（增量，只处理未分析条目）
        │
        ▼  ③ build：合并 + 统计聚合
   data/marks.js          ← App 运行时数据（window.SUPERMARK_DATA）
   data/marks.json        ← 交换/导出用
   data/stats.js          ← 预聚合统计
        │
        ▼  ④ preview / 发布
   浏览器打开（file:// 或 http:// 或在线链接）
        │
        ▼  用户行为（已读/收藏/评分/笔记）
   localStorage（主） / IndexedDB（可选升级）
```

**关键设计：事实层与分析层分离。** raw 只增不改；重跑 analyze 不会丢用户标注，也不会重复消耗 AI 分析。

---

## 3. 输入源与解析规则

### 3.1 支持的输入形态

| 形态 | 示例 | 处理方式 |
| --- | --- | --- |
| A. 批量：微信聊天记录文本 | 本次会话注入的 100 条记录（`.txt` 或对话内粘贴） | `ingest --file <path>` / `ingest --stdin` |
| B. 单条：视频号分享 | `[Channels] 文案 #标签 https://weixin.qq.com/sph/xxx` | `add "<文本>"` 实时追加 |
| C. 纯想法/文本 | `重度思考 AI+个人 IP…` | 同上，标记为 `note` 类型 |
| D. 无文案链接 | `https://weixin.qq.com/sph/xxx` | 入库并标记 `pending-enrich`（仅凭 URL 无法分析，需用户补一句说明，或标为「待补充」） |

**来源平台识别**（URL 域名 → `sourcePlatform`，决定来源图标与后续分发策略）：

| 域名 | platform |
| --- | --- |
| `weixin.qq.com/sph/*` | `channels`（视频号） |
| `mp.weixin.qq.com` | `wechat-mp`（公众号） |
| `xiaohongshu.com` / `xhslink.com` | `xiaohongshu` |
| `bilibili.com` / `b23.tv` | `bilibili` |
| `youtube.com` / `youtu.be` | `youtube` |
| `github.com` | `github` |
| 无 URL | `text` |

v1 对**所有平台都只做「链接 + 文案」的本地存储，不联网抓取正文**：公众号/小红书/B站/YouTube 的标题以你转发时带的文案为准，缺失则标 `pending-enrich`，由你在对话里补一句说明后重新 analyze。理由：抓取需要对抗反爬/Cookie，与「零后端、纯本地」的定位冲突；且视频号链接本就抓不到正文。

### 3.2 解析规则（针对微信导出格式）

一条记录的典型结构：

```
示例用户 08-15 11:44 [Channels] 编曲中，弦乐的五八结构#音乐制作 #编曲 https://weixin.qq.com/sph/A7nWyE9KuP
```

提取字段：
- `sender`：行首到时间戳之前的昵称
- `sentAt`：`MM-DD HH:mm` → 补年份（跨年按记录顺序推断，或用 `--year` 指定）
- `sourceType`：`[Channels]` → 视频号；`[Channel]` → 频道/博主主页；无标记 → 纯文本
- `body` / `tags[]`（`#xxx`，注意中文标签无空格的切分问题）/ `url`（正则 `https?://\S+`）
- 多行合并：首行之后直到下一条「昵称 时间」之间的内容，属于同一条（本样本中存在多行正文）

### 3.3 去重键
- 有 URL：取 URL 中的短链 ID（如 `A7nWyE9KuP`）作为唯一键
- 无 URL：`sha1(前 100 字正文 + 时间)` 前 12 位
- 同键命中 → 保留首次入库记录，仅累加 `dupCount`，不重复分析

---

## 4. 数据模型

```jsonc
{
  "id": "A7nWyE9KuP",             // 唯一键
  "sourceType": "channels",       // channels | channel | text | link | image | file
  "sender": "示例用户",
  "sentAt": "2026-08-15T11:44:00+08:00",
  "url": "https://weixin.qq.com/sph/A7nWyE9KuP",
  "sourcePlatform": "channels",             // channels | wechat-mp | xiaohongshu | bilibili | youtube | github | text
  "rawText": "编曲中，弦乐的五八结构",   // 原文（去掉标签与链接后的正文）
  "rawTags": ["音乐制作", "编曲"],      // 作者自带话题标签
  "dupCount": 1,

  // —— 以下为 analyze 阶段 AI 产出 ——
  "title": "弦乐编曲中的五八度结构",     // 12 字内可扫读标题
  "summary": "……",                    // 1-2 句，讲清「这条是什么 / 讲了什么」
  "keyPoints": ["……", "……"],          // 2-4 条要点（可执行的优先）
  "category": "音乐制作",               // 一级分类（受 taxonomy 约束）
  "subCategory": "编曲",                // 二级
  "tags": ["弦乐", "五八结构"],          // AI 补充标签（≤5）
  "audience": ["self"],                // self | family | kids | parents | work
  "valueType": "tutorial",             // tutorial | insight | tool | inspiration | news | life | entertainment
  "actionable": true,
  "actionHint": "下次编曲时试着用五度叠加铺弦乐",
  "confidence": 0.9,                   // 分类置信度，低于阈值进「待复核」

  // —— 以下为 Web App 中用户产生（本地存储，不回写数据文件）——
  "readStatus": "unread",              // unread | reading | done | archived
  "starred": false,
  "rating": 0,                         // 1-5
  "note": ""
}
```

---

## 5. 分类与标签体系（taxonomy）

**初始一级分类**（基于你现有 100 条样本归纳，写在 `data/taxonomy.json`，可手工编辑）：

1. AI 与编程（Agent / 工具 / 前端 / 开源）
2. 自媒体与内容（起号 / 运营 / 剪辑 / 标题 / 平台规则）
3. 音乐制作（编曲 / 混音 / 音色设计 / 宿主技巧）
4. 育儿与家庭（家庭教育 / 亲子 / 健康）
5. 健康养生（中医 / 食疗 / 身心）
6. 效率与 Mac（软件 / 技巧 / 硬件）
7. 生活方式（农场 / 旅行 / 手工 / 自律）
8. 商业与认知（商业观察 / 个人成长 / 投资）
9. 英语学习
10. 其他 / 待归类

**约束规则（防止标签爆炸）：**
- 一级分类必须是 taxonomy 中已存在的；AI 想新增需置信度高且写入 `taxonomy.pending`，由 `analyze` 报告给用户确认后才转正
- 二级分类与标签可自由生成，但同义词要归并（如「混音」「贴唱混音」→ 混音）
- 每条最多 1 个一级分类 + 5 个标签

---

## 6. 命令设计（skill 的 CLI）

参考 `iskill-english-scene-app`：**由助手代执行，用户只需说意图**。

```
/scripts/mark.mjs <子命令> [参数]
```

| 子命令 | 作用 | 主要参数 |
| --- | --- | --- |
| `init` | 初始化一个实例目录（拷贝 app 模板 + 空数据骨架） | `<dir>` |
| `ingest` | 解析微信聊天记录 → `raw.json`（去重、增量） | `--file <txt>` / `--stdin` / `--year 2026` |
| `add` | 追加单条（链接或文本） | `"<内容>"` |
| `analyze` | 输出「待分析条目清单 + 分析提示词」，助手完成后写回 `enrich.json` | `--limit N` `--only-new`（默认） |
| `build` | 合并 raw + enrich + taxonomy → `marks.js/json` + `stats.js` | `--force` |
| `report` | 控制台输出本次处理摘要（新增/分类分布/待复核） | — |
| `export` | 导出 Markdown 周报 / CSV / `marks.sql`（未来接 SQLite 用） | `--format md\|csv\|sql` `--out <path>` |
| `preview` | 本地起服务并打开预览 | `--port 8712` |
| `task-prompt` | 输出「每周汇总」定时任务的提示词 | — |
| `sync-ima` | **（v1.1）** 把筛选出的条目导出 Markdown / URL 列表，推送到腾讯 ima 知识库 | `--filter starred` `--mode md\|url` `--kb <知识库ID>` |

**`analyze` 的执行约定（重要）：**
脚本只负责「挑出未分析条目 + 生成提示词 + 校验/合并 AI 回填的 JSON」；**语义分类由对话中的助手完成**。这样：
- 不依赖任何外部 API Key / 网络
- 增量：已分析条目永不重跑，成本随收藏量线性可控
- 可人工修正：改 `enrich.json` 里某条，`build` 后即生效

---

## 7. Web App 功能规格

**形态**：手机优先（收藏场景发生在手机上），响应式适配桌面；零外部依赖（无 CDN、无框架），纯静态；PWA（manifest + service worker，仅 http/https 下注册）。

### 7.1 页面

| 页面 | 内容 |
| --- | --- |
| **① 流（默认）** | 卡片流，时间倒序。每卡：分类色条 + 标题 + 1 句摘要 + 标签 + 来源图标 + 时间 + 已读/星标状态。下拉/分页加载（每页 30 条） |
| **② 分类** | 按一级分类聚合，二级分组；顶部标签云（字号 = 出现频次，可点选） |
| **③ 洞察** | 统计可视化（见 7.2） |
| **④ 详情** | 原文全文 + AI 摘要 + 要点清单 + 标签 + 原链接按钮（跳转微信）+ 个人笔记编辑 + 状态/评分 |
| **⑤ 设置/数据** | 导入导出 JSON、清空标注、分类管理、主题（亮/暗/跟随系统）、存储层状态显示 |

### 7.2 可视化（全部手写 SVG，零图表库）

1. **收藏时间线**：按周/月的柱状图，看收藏活跃度
2. **分类占比**：环形图 + 图例（点击跳转筛选）
3. **兴趣热力图**：星期 × 小时的收集密度矩阵（回答「我什么时候在收藏」）
4. **标签云**：Top 30 标签
5. **价值分布**：tutorial / insight / tool / inspiration 等的占比条
6. **待办视图**：`actionable=true` 且未标记 done 的条目单独成列（「收藏了但还没行动」清单）

### 7.3 交互能力

- **搜索**：全文模糊匹配（标题/摘要/要点/原文/标签），高亮命中
- **筛选**：分类 + 标签 + 价值类型 + 受众 + 时间范围 + 状态，多选叠加
- **排序**：时间 / 评分 / 分类
- **状态**：未读 → 在读 → 已读 → 归档；星标；1-5 星评分；个人笔记
- **深链**：`?id=xxx` 直达详情，便于从笔记软件跳回
- **键盘**（桌面）：`/` 聚焦搜索、`j/k` 上下、`Enter` 打开

---

## 8. 存储方案调研结论（wa-sqlite / OPFS）

### 8.1 调研要点

| 方案 | 机制 | 硬约束 |
| --- | --- | --- |
| 官方 `sqlite-wasm` 的 **opfs** VFS | SQLite 文件落在 OPFS，靠 SharedArrayBuffer + Atomics 做同步 | **必须 COOP/COEP 跨源隔离响应头**，纯静态托管（GitHub Pages 等）设不了 → 不可用 |
| 官方 `sqlite-wasm` 的 **opfs-sahpool** VFS | 用 OPFS SyncAccessHandle Pool，不需要 SAB | 必须跑在 **Worker** 上下文；同一文件**不支持多连接并发**（另一标签页打不开）；`file://` 下不可用 |
| `wa-sqlite` 的 **AccessHandlePoolVFS / OPFSCoopSyncVFS / OPFSAdaptiveVFS** | JS 实现 VFS，可选 IndexedDB / OPFS 后端 | 同步版需 Worker；CoopSync 仍需 SAB（即 COOP/COEP）；项目属个人维护，API 迭代频繁、有破坏性变更 |
| `wa-sqlite` 的 **IDBBatchAtomicVFS** | 数据放 IndexedDB | 支持多连接、无需跨源隔离，但性能不如 OPFS |
| **IndexedDB（原生）** | 浏览器内置 NoSQL | 全平台支持、容量百 MB 级；但 `file://` 下 Chrome 会抛 SecurityError |
| **localStorage** | 键值 | `file://` 下可用；容量 ~5MB；同步 API、简单 |

### 8.2 结论：**v1 不引入 wa-sqlite / OPFS，采用「静态数据文件 + localStorage/IndexedDB」**

理由：
1. **写入场景极轻**：本场景是「Agent 离线批量产出只读数据 + 用户少量标注」，不是高频事务写入。SQLite 的核心价值（事务、复杂 SQL、大表）用不上。
2. **部署零负担**：不需要 COOP/COEP 头、不需要 Worker + WASM（约 1MB）、`file://` 双击即开，任何静态托管都能发布。
    - 注意：`file://` 下 `fetch()` 和 `<script type="module">` 会被 CORS 拦，所以数据必须以 `window.SUPERMARK_DATA = {...}` 的 `.js` 形式注入（与 `iskill-english-scene-app` 的 `data/index.js` 同款做法）。
3. **数据量足够小**：按当前节奏约 100 条/月 → 一年 ~1200 条，纯文本总量 < 2MB。前端内存里做过滤/索引毫秒级。
4. **用户标注的持久化**：默认 localStorage（`file://` 也能用），检测到 IndexedDB 可用时自动升级，接口抽象成 `store.js`，后续可无痛替换。

**保留升级通道**：`export --format sql` 输出标准 `CREATE TABLE + INSERT`，未来若数据量过万或需要复杂查询，可在 Worker 内挂载 `sqlite-wasm` 的 `opfs-sahpool` VFS 导入，SQL 层不需要重新设计。

> 待你拍板：如果你更看重「这个 App 本身就是个数据库、能在页面里随意增删改」，我可以把 v1 就做成 wa-sqlite + OPFS（代价：必须 http 托管、多标签页互斥、体积变大）。

---

## 9. skill 目录结构

```
iskill-super-mark/               ← 命名见「10. 待确认」
  SKILL.md                       触发描述 + 命令映射 + 执行约定
  README.md                      面向人的说明（发布/SkillHub 用）
  scripts/
    mark.mjs                     CLI 入口（init/ingest/add/analyze/build/report/export/preview/task-prompt）
    lib/
      parse-wechat.mjs           微信聊天记录解析
      platform.mjs               URL → 来源平台识别（channels/公众号/小红书/B站/YouTube/GitHub）
      dedupe.mjs                 去重键与增量合并
      taxonomy.mjs               分类体系加载/校验/待转正队列
      build.mjs                  raw+enrich → marks.js/json + stats.js
      store-template.mjs         生成空数据骨架
  app/                           Web App 模板（init 时拷到实例目录）
    index.html                   单页（hash 路由：#/flow #/topic #/insight #/item/:id #/settings）
    manifest.json
    sw.js
    assets/
      app.css                    主题变量（亮/暗）、移动端安全区
      data.js                    运行时数据加载（window.SUPERMARK_DATA）
      store.js                   标注持久化（localStorage → IndexedDB 分层）
      filter.js                  搜索/筛选/排序
      charts.js                  手写 SVG 图表（柱/环/热力/云）
      views.js                   五个视图渲染
      app.js                     路由与事件绑定
    data/
      marks.js                   build 产物（运行时）
      marks.json                 交换用
      stats.js                   预聚合统计
  docs/
    requirements.md              本文档
```

---

## 10. ima 联动评估（你提出的第 5 点）

**腾讯 ima（ima.qq.com，腾讯 AI 工作台 / 知识库）确实有 OpenAPI** —— 凭证在 `ima.qq.com/agent-interface` 页面扫码申请（Client ID + Api Key），请求走自定义 Header（`ima-openapi-clientid` / `ima-openapi-apikey`），已知两类相关接口：

| 接口 | 用途 | 适配度 |
| --- | --- | --- |
| `POST /openapi/note/v1/import_doc` | 以 Markdown 内容导入一篇文档 | ⭐ 高 —— 我们可以把「原文 + AI 摘要 + 要点 + 原链接」拼成一篇 Markdown 推进去 |
| `POST /openapi/wiki/v1/import_urls` | 批量导入 URL（1–10 个）到指定知识库 | 中 —— ima 会自行抓取网页；但**视频号 `sph` 链接抓不到正文**，基本只能存个壳 |
| `/openapi/note/v1/*`、`/openapi/wiki/v1/*`（列表/知识库管理） | 读方向 | 弱 —— 第三方资料显示读能力有限，且版本迭代频繁（v3.0 刚做过端点迁移） |

**结论：值得做，但定位为「单向出口」，放 v1.1，不进 v1。**

- **做什么**：`sync-ima` 命令 → 按筛选条件（默认「星标 + 已读」）生成 Markdown，调用 `import_doc` 推入指定知识库，回写 `imaSyncedAt` 字段避免重复推送。
- **为什么单向**：ima 的核心增量价值是「云端 50G 空间 + 语义检索/问答 + 多端同步 + 混元/DeepSeek 深度研究」，正好补上本地 App 只有关键词搜索的短板；反向同步（从 ima 拉回）接口弱且不稳定，不做。
- **为什么放 v1.1**：需要你先在 ima 开放平台申请凭证；接口细节（端点/参数/知识库 ID）以申请到的官方文档为准，第三方博客的信息有版本漂移风险。
- **凭证存放**：`~/.workbuddy/iskill-super-mark/config.json`（加入 `.gitignore`，绝不进 git / 绝不写进 skill 仓库）。
- **降级路径**：没凭证时，`export --format md` 依然产出同样的 Markdown 文件，你手动拖进 ima 客户端即可——功能不依赖 API。

---

## 11. 决策记录（已确认）

| # | 议题 | 结论 |
| --- | --- | --- |
| 1 | 命名 | **`iskill-super-mark`**，四处统一（GitHub 仓库 / 本地 git 目录 / `~/.workbuddy/skills/` active 目录 / SKILL.md `name`）。口头仍叫 super-mark |
| 2 | 存储 | **不引入 wa-sqlite / OPFS**（见 §8.2）。静态数据 `marks.js` + localStorage（可用时升级 IndexedDB），预留 `export --format sql` 通道 |
| 3 | v1 范围 | 命令：`init / ingest / add / analyze / build / report / preview`；页面：流、分类、洞察、详情。`export`、`PWA`、`task-prompt`、`sync-ima` → v1.1 |
| 4 | 分类体系 | 采用 §5 的 10 个初始分类，写入 `taxonomy.json` 可随时编辑 |
| 5 | 输入源 | 微信聊天记录批量导入 + 单条实时追加 + 公众号/小红书/B站/YouTube 的**来源识别与图标**（均不联网抓取正文） |
| 6 | ima 联动 | v1.1 单向导出（`sync-ima`），见 §10 |

---

## 12. 验收标准（v1）

1. 把本次会话里那 100 条聊天记录丢给 `ingest`，能正确解析出 ≥95 条条目，链接、标签、时间无错漏，重复转发自动合并。
2. `analyze` 后 100 条全部有标题/摘要/分类；「其他/待归类」占比 < 10%。
3. `build` 后 `file://` 双击 `index.html` 能正常打开并看到全部内容。
4. 手机浏览器（Safari/微信内置）打开：卡片流可读、筛选可用、搜索响应 < 200ms。
5. 标记已读/加笔记后刷新页面，状态仍在；重新 `build` 后状态不丢。
6. 洞察页六张图全部渲染正确，数字与 marks.json 一致。
7. 各来源平台图标正确（视频号/公众号/小红书/B站/YouTube/GitHub/纯文本）。

---

## 13. 开发顺序（确认后按此执行）

1. **骨架**：建 `~/.workbuddy/skills/iskill-super-mark`（软链到 `/Users/lv/WorkBuddy/ISkills/iskill-super-mark`，与既有 iskill 系列一致）→ SKILL.md + README.md + 目录结构
2. **解析层**：`parse-wechat.mjs` + `platform.mjs` + `dedupe.mjs`，先用本次 100 条样本跑通 `ingest`，人工核对解析准确率
3. **App 模板**：`app/` 静态站点（流 / 分类 / 洞察 / 详情），先造 mock 数据把界面调好
4. **分析层**：`analyze`（待分析清单 + 提示词 → 助手回填 `enrich.json`）+ `taxonomy.mjs`
5. **构建层**：`build` 产出 `marks.js/json` + `stats.js`，`report` 摘要
6. **联调验收**：按 §12 逐条走一遍；用那 100 条真实数据作为首个实例，确认后即可发布为在线链接
7. **（v1.1）** export / PWA / task-prompt / sync-ima
