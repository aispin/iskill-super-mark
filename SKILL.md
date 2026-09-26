---
name: iskill-super-mark
description: 把微信（视频号/公众号）里随手转发收藏的内容，变成一本可检索、可分类、有洞察的个人「收藏册」网页应用。提供 init/ingest/add/analyze/build/report/preview 七个命令：初始化实例、批量导入微信聊天记录、单条追加、AI 逐条分类打标（标题/摘要/要点/分类/标签/价值类型/是否可行动）、生成运行时数据、控制台摘要、本地预览。交付物是零外部依赖的纯静态站点（杂志编辑风、手机优先、file:// 双击即开）。当用户说「整理我收藏的微信内容」「把转发的视频号做个知识库」「收藏册」「super mark」「分析我转发的链接」时使用。
agent_created: true
---

# super-mark · 收藏册

把「微信里随手转发的碎片内容」变成「可检索、可分类、可回看、有洞察的私人知识库」。

**核心设计：事实层与分析层分离。** `raw.json` 只增不改，`enrich.json` 增量累积，用户标注存在浏览器本地。重跑分析不会丢标注，也不会重复消耗成本。

## 何时用
- 用户把微信聊天记录（转发到文件传输助手/WorkBuddy 任务对话的）丢过来，想整理归类。
- 用户想可视化看看「我到底收藏了什么、集中在哪些主题、哪些是真正有用的」。
- 用户转发单条链接/想法，想随手入库。

## 交付物结构（一个「实例」目录）
```
<实例>/
  index.html            单页应用（hash 路由，脚本按顺序加载，file:// 可直接打开）
  assets/
    app.css             设计令牌与组件样式（杂志编辑风，亮/暗双主题）
    data.js             读取 window.SUPERMARK_DATA，建索引与格式化
    store.js            用户标注持久化（localStorage 为主，IndexedDB 可用时升级并迁移）
    filter.js           筛选状态与过滤/排序
    charts.js           手写 SVG 图表（柱状 / 环形 / 热力矩阵 / 水平条）
    views.js            流、主题、洞察、详情四个视图的渲染
    app.js              路由、事件委托、入场编排、主题切换
  data/
    raw.json            事实层：解析后的原始条目（只增不改）
    enrich.json         分析层：AI 产出的分类打标（按 id 增量）
    pending.json        analyze 导出的待分析清单
    taxonomy.json       分类体系（可手工编辑；空数组=用默认）
    marks.js            运行时数据 window.SUPERMARK_DATA（build 产物）
    marks.json          同上，交换/导出用
    stats.js            预聚合统计 window.SUPERMARK_STATS
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
**方向：杂志编辑风（Editorial）——「一本属于你的收藏杂志」。**

- 暖纸色底 `#F4F1E9`（不是纯白），暖近黑文字，唯一强调色朱砂 `#C2410C`；暗色主题用墨底 `#14120F`。
- 展示字宋体（`Songti SC`）+ 正文黑体（`PingFang SC`）+ 数字等宽（`SF Mono`），**全系统字体栈、零网络依赖**。禁用 Inter/Roboto/system-ui 等通用字体。
- 条目用**发丝规则线分隔 + 左侧分类色条 + 等宽编号 `No.001`**，不是统一圆角的卡片堆。
- 背景有极细横纹与噪点氛围层；hover 是标题下划线扫过 + 色条变宽，不是单纯变亮。
- 动效错峰入场（≤8 组），`prefers-reduced-motion` 下全关。
- 反 AI 味红线：不要三张一样圆角特性卡、不要白底紫渐变、不要无主色的粉彩、不要通用线性图标堆砌。

## 存储方案（已调研，勿轻易推翻）
**不引入 wa-sqlite / OPFS。** 理由：
- 官方 sqlite-wasm 的 `opfs` VFS 需要 COOP/COEP 跨源隔离响应头，纯静态托管设不了；`opfs-sahpool` 必须跑 Worker 且不支持多标签页并发，`file://` 不可用。
- 本场景是「离线批量产出只读数据 + 用户少量标注」，写入极轻，SQLite 的事务与大表能力用不上。
- 数据量按 100 条/月估算，一年约 1200 条、文本 < 2MB，前端内存过滤毫秒级。

因此：数据以 `window.SUPERMARK_DATA = {...}` 的 `.js` 形式注入（规避 `file://` 下 fetch 的 CORS 限制），用户标注走 localStorage（file:// 亦可用），IndexedDB 可用时自动升级并迁移。未来若数据量过万或需要复杂查询，再在 Worker 内挂 `sqlite-wasm` 的 `opfs-sahpool`，SQL 层无需重设计。

## 隐私
全部数据留在本地：实例目录 + 浏览器本地存储，无后端、无埋点、无外链请求（除用户主动点「打开原内容」跳转微信）。不上传任何内容到第三方；若将来接 ima 同步，凭证放 `~/.workbuddy/iskill-super-mark/config.json` 并加入 .gitignore，绝不进仓库。
