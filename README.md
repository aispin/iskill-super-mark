# super-mark · 收藏册

把微信里随手转发收藏的碎片内容（视频号 / 公众号 / 小红书 / B站 / YouTube / GitHub），变成一本**可检索、可分类、可回看、有洞察**的个人收藏册。

> 你刷到好内容 → 转发到文件传输助手（或 WorkBuddy 任务对话）→ 一个命令解析入库 → AI 逐条分类打标 → 打开网页端详。

## 它解决什么

| 以前 | 现在 |
| --- | --- |
| 只有一条平铺的时间线，无分类无标题 | 96 条收藏自动归到 10 个主题，每条有标题、摘要、要点 |
| 想找「那条讲低频质感的视频」只能靠记忆翻记录 | 全文搜索（标题/摘要/要点/原文/标签）+ 分类与标签筛选 |
| 不知道自己收藏了什么、集中在哪里 | 洞察页：收藏节奏、注意力分布、星期×小时热力图、可行动清单 |
| 收藏 = 吃灰 | 每条标注「可做」，配一个具体动作提示，读完可打勾 |

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

# 4. 构建运行时数据
node scripts/mark.mjs build ~/WorkBuddy/SuperMark

# 5. 预览
node scripts/mark.mjs preview ~/WorkBuddy/SuperMark
```

在 WorkBuddy 里直接说意图即可：「把我这段聊天记录入库」「分析新收藏的」「打开预览」。

## 四个视图

- **时间流**：倒序条目流，左侧分类色条 + `No.001` 编号，hover 标题下划线扫过
- **主题**：按一级分类聚合 + 标签云（字号随频次）
- **洞察**：收藏节奏柱状图、分类占比环形图、星期×小时热力图、价值类型与来源构成、待办清单
- **详情**：AI 摘要（引言块）+ 编号要点 + 原文 + 状态/评分/笔记 + 打开原内容

## 设计定调

**杂志编辑风（Editorial）**——「一本属于你的收藏杂志」。暖纸色底、`Songti SC` 宋体大标题、发丝规则线分隔、朱砂单强调色、等宽编号；暗色主题为墨底。全系统字体栈，零网络依赖。

## 技术选择

- **零外部依赖**：无框架、无 CDN、无构建步骤；`file://` 双击 `index.html` 即可打开
- **不用 wa-sqlite / OPFS**：静态托管设不了 COOP/COEP 头，`file://` 下 OPFS 不可用，而本场景写入极轻。数据以 `window.SUPERMARK_DATA` 注入，标注走 localStorage（IndexedDB 可用时自动升级）
- **事实层 / 分析层分离**：`raw.json` 只增不改，`enrich.json` 增量累积，重跑分析不丢标注、不重复消耗

## 目录结构

```
scripts/mark.mjs          CLI 入口
scripts/lib/              parse-wechat / platform / dedupe / taxonomy / build
app/                      Web App 模板（init 时拷进实例）
docs/requirements.md      需求规格
examples/wechat-sample.txt 真实样本（96 条）
```

数据模型、分类体系、analyze 的执行约定，见 `SKILL.md`。
