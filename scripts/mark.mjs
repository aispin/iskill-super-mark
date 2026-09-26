#!/usr/bin/env node
// super-mark CLI：微信收藏内容 → 结构化数据 → 可视化 Web App
// 用法：node mark.mjs <子命令> [参数]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChatLog, parseSingle } from './lib/parse-wechat.mjs';
import { mergeRaw, pendingItems } from './lib/dedupe.mjs';
import { buildMarks, buildStats, writeOutputs } from './lib/build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(HERE);
const TEMPLATE_DIR = path.join(SKILL_DIR, 'app');

const readJson = (p, f) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : f);
const writeJson = (p, v) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2), 'utf8');
};

const args = process.argv.slice(2);
const cmd = args[0] || 'help';
const flags = {};
const positional = [];
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=');
    flags[k] = v === undefined ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true) : v;
  } else positional.push(a);
}

const dataPaths = (dir) => ({
  raw: path.join(dir, 'data', 'raw.json'),
  enrich: path.join(dir, 'data', 'enrich.json'),
  pending: path.join(dir, 'data', 'pending.json'),
  taxonomy: path.join(dir, 'data', 'taxonomy.json'),
});

/* ---------------- init ---------------- */
function init() {
  const dir = path.resolve(positional[0] || './super-mark');
  if (fs.existsSync(path.join(dir, 'index.html'))) {
    console.log(`已存在实例：${dir}（跳过拷贝模板）`);
  } else {
    fs.mkdirSync(dir, { recursive: true });
    for (const entry of fs.readdirSync(TEMPLATE_DIR, { withFileTypes: true })) {
      if (entry.name === 'data') continue;
      const src = path.join(TEMPLATE_DIR, entry.name);
      const dst = path.join(dir, entry.name);
      fs.cpSync(src, dst, { recursive: true });
    }
    console.log(`已初始化实例：${dir}`);
  }
  const p = dataPaths(dir);
  if (!fs.existsSync(p.raw)) writeJson(p.raw, { version: 1, items: [] });
  if (!fs.existsSync(p.enrich)) writeJson(p.enrich, { version: 1, items: {} });
  if (!fs.existsSync(p.taxonomy)) writeJson(p.taxonomy, { version: 1, categories: [] });
  console.log(`数据骨架就绪：${path.join(dir, 'data')}`);
  console.log(`下一步：node mark.mjs ingest ${dir} --file <聊天记录.txt>`);
}

/* ---------------- ingest ---------------- */
function ingest() {
  const dir = path.resolve(positional[0] || '.');
  const p = dataPaths(dir);
  let text = '';
  if (flags.file) {
    text = fs.readFileSync(path.resolve(flags.file), 'utf8');
  } else if (flags.stdin) {
    text = fs.readFileSync(0, 'utf8');
  } else {
    console.error('需要 --file <路径> 或 --stdin');
    process.exit(1);
  }
  const year = flags.year ? Number(flags.year) : undefined;
  const { items, skipped } = parseChatLog(text, { year });
  const raw = readJson(p.raw, { version: 1, items: [] });
  const merged = mergeRaw(raw.items || [], items);
  writeJson(p.raw, { version: 1, updatedAt: new Date().toISOString(), items: merged.items });

  const withUrl = merged.items.filter((i) => i.url).length;
  console.log(`解析 ${items.length} 条（空消息 ${skipped.length} 条）`);
  console.log(`新增 ${merged.added} 条，重复合并 ${merged.dup} 条，累计 ${merged.total} 条`);
  console.log(`含链接 ${withUrl} 条，纯文本 ${merged.total - withUrl} 条`);
  const sample = merged.items.slice(-3).map((i) => `  · [${i.sourcePlatform}] ${i.rawText.slice(0, 28)}${i.url ? ' 🔗' : ''}`);
  if (sample.length) console.log('最新三条：\n' + sample.join('\n'));
}

/* ---------------- add ---------------- */
function add() {
  const dir = path.resolve(positional[0] || '.');
  const text = positional.slice(1).join(' ') || (flags.text || '');
  if (!text) {
    console.error('用法：add <实例目录> "<内容>"');
    process.exit(1);
  }
  const p = dataPaths(dir);
  const item = parseSingle(text, { year: flags.year ? Number(flags.year) : undefined });
  const raw = readJson(p.raw, { version: 1, items: [] });
  const merged = mergeRaw(raw.items || [], [item]);
  writeJson(p.raw, { version: 1, updatedAt: new Date().toISOString(), items: merged.items });
  console.log(`${merged.added ? '已新增' : '已存在（累加重复计数）'}：${item.id} · ${item.rawText.slice(0, 30)}`);
}

/* ---------------- analyze ---------------- */
const PROMPT = `你是私人知识库的内容编辑。请为下列收藏条目逐条产出结构化 JSON。

规则：
- category 必须是给定分类 id 之一；实在不属于任何分类才用 other
- title ≤ 14 字，能一眼认出这条是什么
- summary 1-2 句，说清「这条讲了什么」
- keyPoints 2-4 条，可执行的优先；纯消遣内容可给 1 条
- tags ≤ 5 个，具体名词，避免与分类名重复
- audience/valueType 取值见 taxonomy.json
- actionable：看完是否有一个明确可做的动作
- 无文案、只有链接的条目：title 写「（仅链接）」，summary 写「无文案，需回看原内容确认」，confidence 0.3

输出：一个 JSON 数组，每项形如
{"id":"...","title":"...","summary":"...","keyPoints":["..."],"category":"...","subCategory":"...","tags":["..."],"audience":["self"],"valueType":"tutorial","actionable":true,"actionHint":"...","confidence":0.9}
只输出 JSON，不要解释。`;

function analyze() {
  const dir = path.resolve(positional[0] || '.');
  const p = dataPaths(dir);
  const raw = readJson(p.raw, { version: 1, items: [] });
  const enrichFile = readJson(p.enrich, { version: 1, items: {} });
  const limit = flags.limit ? Number(flags.limit) : 40;

  if (flags.apply) {
    const incoming = readJson(path.resolve(flags.apply), null);
    const list = Array.isArray(incoming) ? incoming : incoming?.items ? Object.values(incoming.items) : null;
    if (!list) {
      console.error('--apply 需要一个 JSON 数组（或 {items:[...]}）');
      process.exit(1);
    }
    let n = 0;
    for (const e of list) {
      if (!e || !e.id) continue;
      enrichFile.items[e.id] = { ...(enrichFile.items[e.id] || {}), ...e, updatedAt: new Date().toISOString() };
      n += 1;
    }
    writeJson(p.enrich, enrichFile);
    const done = Object.keys(enrichFile.items).length;
    console.log(`已写入 ${n} 条分析结果，累计已分析 ${done} / ${(raw.items || []).length} 条`);
    console.log(`下一步：node mark.mjs build ${dir}`);
    return;
  }

  const pend = pendingItems(raw.items || [], enrichFile.items || {}).slice(0, limit);
  const slim = pend.map((it) => ({
    id: it.id,
    sentAt: it.sentAt,
    platform: it.sourcePlatform,
    url: it.url,
    rawText: it.rawText,
    rawTags: it.rawTags,
  }));
  writeJson(p.pending, slim);
  console.log(PROMPT);
  console.log(`\n待分析 ${pend.length} 条（共 ${(raw.items || []).length} 条，已分析 ${Object.keys(enrichFile.items || {}).length} 条）`);
  console.log(`清单已写入：${p.pending}`);
  console.log('条目如下：\n' + JSON.stringify(slim, null, 2));
}

/* ---------------- build ---------------- */
function build() {
  const dir = path.resolve(positional[0] || '.');
  const p = dataPaths(dir);
  const raw = readJson(p.raw, { version: 1, items: [] });
  const enrichFile = readJson(p.enrich, { version: 1, items: {} });
  const pend = pendingItems(raw.items || [], enrichFile.items || {}).length;
  const { marks, tax } = buildMarks(dir);
  const stats = buildStats(marks, tax, pend);
  writeOutputs(dir, { marks, tax }, stats);
  console.log(`已生成：${path.join(dir, 'data', 'marks.js')}（${marks.length} 条）`);
  console.log(`已分析 ${stats.enriched} 条，待分析 ${stats.pending} 条，可执行 ${stats.actionable} 条`);
  const top = stats.byCategory.slice(0, 5).map((c) => `${c.name || c.id} ${c.count}`).join(' · ');
  console.log(`分类 Top5：${top}`);
}

/* ---------------- report ---------------- */
function report() {
  const dir = path.resolve(positional[0] || '.');
  const p = dataPaths(dir);
  const raw = readJson(p.raw, { version: 1, items: [] });
  const enrichFile = readJson(p.enrich, { version: 1, items: {} });
  const items = raw.items || [];
  const pending = pendingItems(items, enrichFile.items || {});
  const lowConf = Object.values(enrichFile.items || {}).filter((e) => (e.confidence || 0) < 0.6);
  console.log(`实例：${dir}`);
  console.log(`收藏 ${items.length} 条｜已分析 ${items.length - pending.length} 条｜待分析 ${pending.length} 条`);
  console.log(`低置信度（<0.6，建议复核）${lowConf.length} 条`);
  if (pending.length) console.log(`待分析 id：${pending.slice(0, 10).map((i) => i.id).join(', ')}${pending.length > 10 ? ' …' : ''}`);
  const marksFile = path.join(dir, 'data', 'marks.json');
  if (fs.existsSync(marksFile)) {
    const d = readJson(marksFile, null);
    console.log(`最近构建：${d?.stats?.builtAt || '-'}｜分类 ${(d?.stats?.byCategory || []).length} 个`);
  }
}

/* ---------------- preview ---------------- */
async function preview() {
  const dir = path.resolve(positional[0] || '.');
  const port = Number(flags.port || 8712);
  const http = await import('node:http');
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const file = path.join(dir, rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(port, () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`预览地址：${url}`);
    import('node:child_process')
      .then(({ execSync }) => execSync(`open "${url}"`))
      .catch(() => {
        /* 非 macOS 忽略 */
      });
  });
}

/* ---------------- help ---------------- */
function help() {
  console.log(`super-mark —— 微信收藏内容可视化知识库

用法：node mark.mjs <子命令> [参数]

  init <dir>                     初始化实例（拷贝 App 模板 + 数据骨架）
  ingest <dir> --file <txt>      批量导入微信聊天记录（--stdin 从管道读，--year 指定年份）
  add <dir> "<内容>"              追加单条链接或想法
  analyze <dir>                  输出待分析清单与提示词（--limit N，默认 40）
  analyze <dir> --apply <json>   合并 AI 回填的分析结果
  build <dir>                    生成 marks.js / marks.json / stats.js
  report <dir>                   控制台摘要
  preview <dir> [--port 8712]    本地预览
`);
}

const map = { init, ingest, add, analyze, build, report, preview, help };
Promise.resolve((map[cmd] || help)()).catch((e) => {
  console.error(e);
  process.exit(1);
});
