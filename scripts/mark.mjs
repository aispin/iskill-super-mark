#!/usr/bin/env node
// super-mark CLI：微信收藏内容 → 结构化数据 → 可视化 Web App
// 用法：node mark.mjs <子命令> [参数]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChatLog, parseSingle } from './lib/parse-wechat.mjs';
import { mergeRaw, pendingItems } from './lib/dedupe.mjs';
import { buildMarks, buildStats, writeOutputs } from './lib/build.mjs';
import { acquireAudio, importAudioFile, probeCapabilities, audioDuration } from './lib/audio.mjs';
import { transcribe, probeAsr } from './lib/asr.mjs';

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
  transcripts: path.join(dir, 'data', 'transcripts.json'),
  deep: path.join(dir, 'data', 'deep.json'),
  pendingDeep: path.join(dir, 'data', 'pending-deep.json'),
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
  if (!fs.existsSync(p.transcripts)) writeJson(p.transcripts, { version: 1, items: {} });
  if (!fs.existsSync(p.deep)) writeJson(p.deep, { version: 1, items: {} });
  fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'inbox'), { recursive: true });
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

/* ---------------- fetch：把链接收藏变成本地 mp3 ---------------- */
async function fetchAudio() {
  const dir = path.resolve(positional[0] || '.');
  const p = dataPaths(dir);
  const raw = readJson(p.raw, { version: 1, items: [] });
  const mediaDir = path.join(dir, 'media');

  // 单条手工投放：--file <录屏.mp4> --id <条目id>
  if (flags.file) {
    if (!flags.id) { console.error('--file 需要同时给 --id <条目id>'); process.exit(1); }
    const r = await importAudioFile(path.resolve(flags.file), dir, flags.id);
    console.log(r.ok ? `已导入 ${flags.id} → ${r.file}` : `导入失败：${r.reason}`);
    return;
  }

  let list = (raw.items || []).filter((i) => i.url);
  if (flags.id) list = list.filter((i) => i.id === flags.id);
  if (flags.platform) list = list.filter((i) => i.sourcePlatform === flags.platform);
  if (!flags.all && !flags.force) {
    list = list.filter((i) => !fs.existsSync(path.join(mediaDir, `${i.id}.mp3`)));
  }
  const limit = flags.limit ? Number(flags.limit) : 5;
  const todo = list.slice(0, limit);

  if (!todo.length) {
    console.log('没有待抓取的条目（都已有 mp3，或用 --all / --force 强制重跑）');
    return;
  }

  const caps = probeCapabilities();
  console.log(`yt-dlp ${caps.ytdlpVersion || '(未安装)'}｜视频号插件 ${caps.weixinSupport ? '已加载' : '无'}｜ffmpeg ${caps.ffmpeg ? '有' : '无'}`);
  console.log(`待处理 ${todo.length} 条\n`);

  let ok = 0;
  for (const it of todo) {
    const r = await acquireAudio(it, dir, {
      force: !!flags.force,
      cookiesFromBrowser: typeof flags['cookies-from-browser'] === 'string' ? flags['cookies-from-browser'] : undefined,
      cookiesFile: flags.cookies,
    });
    if (r.ok) {
      ok += 1;
      const dur = await audioDuration(r.file);
      console.log(`✓ ${it.id} [${r.method}] ${dur ? Math.round(dur / 60) + ' 分钟' : ''} ${(it.rawText || '').slice(0, 24)}`);
    } else {
      console.log(`✗ ${it.id} ${(it.rawText || '').slice(0, 24)}`);
      console.log(`   原因：${r.reason}`);
      if (r.sniffed?.length) console.log(`   嗅探到的直链：${r.sniffed.slice(0, 2).join(' , ')}`);
    }
  }
  console.log(`\n成功 ${ok} / ${todo.length}`);
  if (ok < todo.length) {
    console.log(`
视频号抓不到时的两条路（任选其一）：
  A) 带登录态 cookies：浏览器登录 channels.weixin.qq.com 后
     node mark.mjs fetch ${dir} --id <id> --cookies-from-browser chrome
     或导出 Netscape 格式 cookies 到文件后 --cookies <cookies.txt>
  B) 最稳：把视频录屏成 mp4 放进 ${path.join(dir, 'inbox')}/（文件名以条目 id 开头），再跑一次 fetch`);
  }
}

/* ---------------- transcribe：mp3 → 文字稿 ---------------- */
async function transcribeCmd() {
  const dir = path.resolve(positional[0] || '.');
  const p = dataPaths(dir);
  const raw = readJson(p.raw, { version: 1, items: [] });
  const mediaDir = path.join(dir, 'media');
  const store = readJson(p.transcripts, { version: 1, items: {} });
  store.items = store.items || {};

  const asr = await probeAsr();
  console.log(`转写引擎：${asr.voicebox ? 'VoiceBox(' + asr.voicebox.url + ')' : '无'}${asr.whisperCli ? ' + ' + path.basename(asr.whisperCli) : ''}${asr.voicestudio ? ' + VoiceStudio' : ''}`);
  if (!asr.ready) {
    console.log('没有可用引擎。打开 VoiceBox 即可（本地 Whisper，中文效果好）；或 pip install mlx-whisper');
    return;
  }

  let list = (raw.items || []).filter((i) => fs.existsSync(path.join(mediaDir, `${i.id}.mp3`)));
  if (flags.id) list = list.filter((i) => i.id === flags.id);
  if (!flags.redo) list = list.filter((i) => !store.items[i.id]?.text);
  const todo = list.slice(0, flags.limit ? Number(flags.limit) : 3);

  if (!todo.length) { console.log('没有待转写的音频（先跑 fetch，或加 --redo 重跑）'); return; }

  let ok = 0;
  for (const it of todo) {
    const mp3 = path.join(mediaDir, `${it.id}.mp3`);
    const dur = await audioDuration(mp3);
    process.stdout.write(`… ${it.id}（${dur ? Math.round(dur / 60) + ' 分钟' : '未知时长'}）`);
    const r = await transcribe(mp3, { language: flags.lang || 'zh', engine: flags.engine, outDir: path.join(dir, 'media') });
    if (r.ok) {
      ok += 1;
      store.items[it.id] = {
        text: r.text, engine: r.engine, lang: flags.lang || 'zh',
        durationSec: dur, audioPath: `media/${it.id}.mp3`, at: new Date().toISOString(),
      };
      writeJson(p.transcripts, store); // 逐条落盘，中断也不丢
      console.log(`\r✓ ${it.id} ${r.engine} · ${r.text.length} 字`);
    } else {
      console.log(`\r✗ ${it.id} ${r.reason}`);
    }
  }
  console.log(`\n转写完成 ${ok} / ${todo.length}，累计 ${Object.keys(store.items).length} 条`);
  console.log(`下一步：node mark.mjs deep ${dir}`);
}

/* ---------------- deep：读转写稿，产出深度解读 ---------------- */
const DEEP_PROMPT = `你是私人知识库的资深内容编辑。下面每条都带**完整音频转写稿**（不是标题、不是简介）。
请基于转写稿做真正的深读，而不是复述标题。

要求：
- thesis：这条内容的核心论点是什么（1-2 句，说人话，别用「介绍了…」这种空话）
- steps：如果讲了方法/流程/操作，拆成 2-6 条能照着做的步骤；没有就给空数组
- facts：稿子里出现的具体数字、工具名、书名、人名、案例等硬信息，逐条列出（没有就空数组）
- takeaway：对「我」最有价值的一条结论，要具体、可执行、可直接改变做法
- caveats：讲者的前提假设、明显过时的地方、或你不同意的地方
- related：与这批收藏里其它条目的关联（写清和哪条、什么关系）；没有就空数组

铁律：
- 只依据转写稿内容，禁止脑补稿子里没有的信息
- 转写稿可能有识别错误，遇到明显不通顺处按上下文合理理解，但不要编造事实
- 每条 20 字以上的实质信息不少于 3 条，纯消遣内容可以少但要说明原因

输出一个 JSON 数组，每项：
{"id":"...","thesis":"...","steps":["..."],"facts":["..."],"takeaway":"...","caveats":["..."],"related":["..."]}
只输出 JSON，不要解释。`;

function deep() {
  const dir = path.resolve(positional[0] || '.');
  const p = dataPaths(dir);
  const raw = readJson(p.raw, { version: 1, items: [] });
  const enrichFile = readJson(p.enrich, { version: 1, items: {} });
  const tr = readJson(p.transcripts, { version: 1, items: {} });
  const deepFile = readJson(p.deep, { version: 1, items: {} });
  deepFile.items = deepFile.items || {};

  if (flags.apply) {
    const incoming = readJson(path.resolve(flags.apply), null);
    const list = Array.isArray(incoming) ? incoming : incoming?.items ? Object.values(incoming.items) : null;
    if (!list) { console.error('--apply 需要一个 JSON 数组'); process.exit(1); }
    let n = 0;
    for (const e of list) {
      if (!e?.id) continue;
      deepFile.items[e.id] = { ...e, updatedAt: new Date().toISOString() };
      n += 1;
    }
    writeJson(p.deep, deepFile);
    console.log(`已写入 ${n} 条深读，累计 ${Object.keys(deepFile.items).length} 条`);
    console.log(`下一步：node mark.mjs build ${dir}`);
    return;
  }

  const limit = flags.limit ? Number(flags.limit) : 6;
  const maxChars = flags.chars ? Number(flags.chars) : 7000;

  let list = (raw.items || []).filter((i) => tr.items[i.id]?.text);
  if (flags.id) list = list.filter((i) => i.id === flags.id);
  if (!flags.redo) list = list.filter((i) => !deepFile.items[i.id]);
  const todo = list.slice(0, limit);

  if (!todo.length) {
    console.log(`没有待深读的条目。`);
    console.log(`有转写稿的 ${Object.keys(tr.items).length} 条，已深读 ${Object.keys(deepFile.items).length} 条。`);
    if (!Object.keys(tr.items).length) console.log(`需要先跑：node mark.mjs fetch ${dir} && node mark.mjs transcribe ${dir}`);
    return;
  }

  const slim = todo.map((it) => {
    const e = enrichFile.items?.[it.id] || {};
    let text = tr.items[it.id].text || '';
    if (text.length > maxChars) text = text.slice(0, maxChars) + '…（后略）';
    return {
      id: it.id,
      title: e.title || it.rawText.slice(0, 24),
      category: e.category || '',
      platform: it.sourcePlatform,
      url: it.url || '',
      transcriptChars: (tr.items[it.id].text || '').length,
      transcript: text,
    };
  });
  writeJson(p.pendingDeep, slim);
  console.log(DEEP_PROMPT);
  console.log(`\n待深读 ${todo.length} 条（有转写稿共 ${Object.keys(tr.items).length} 条）`);
  console.log(`清单已写入：${p.pendingDeep}`);
  console.log(JSON.stringify(slim, null, 2));
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
  console.log(`已转写 ${stats.transcribed} 条，已深读 ${stats.deepened} 条`);
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

/* ---------------- caps：能力体检 ---------------- */
async function caps() {
  const c = probeCapabilities();
  const a = await probeAsr();
  const mark = (b) => (b ? '✓' : '✗');
  console.log(`抓音频
  ${mark(c.ytdlp)} yt-dlp            ${c.ytdlp || '（未安装）'}${c.ytdlpVersion ? ' · ' + c.ytdlpVersion : ''}
  ${mark(c.weixinSupport)} 视频号解析插件    ${c.weixinSupport ? c.ytdlpPlugins.join(', ') : '（未安装 yt-dlp-patch）'}
  ${mark(c.ffmpeg)} ffmpeg            ${c.ffmpeg || '（未安装）'}
  ${mark(c.browser)} 无头浏览器        ${c.browser ? '可用（用于嗅探媒体直链）' : '（无）'}
  ${mark(c.puppeteer)} puppeteer         ${c.puppeteer ? '可用' : '（无）'}
  ${mark(c.virtualAudio)} 虚拟声卡          ${c.virtualAudio || '（无，不影响主流程）'}

转写
  ${mark(a.voicebox)} VoiceBox          ${a.voicebox ? a.voicebox.status + ' · ' + a.voicebox.url : '（未运行）'}
  ${mark(a.whisperCli)} whisper CLI       ${a.whisperCli || '（未安装）'}
  ${mark(a.voicestudio)} VoiceStudio       ${a.voicestudio ? a.voicestudio.status.slice(0, 50) : '（未运行，且其默认 ASR 多为英文模型）'}

结论：${a.ready ? '可以跑完整链路（fetch → transcribe → deep）' : '转写引擎缺失，打开 VoiceBox 即可（本地 Whisper，中文效果好）'}`);
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
  fetch <dir>                    抓音频：链接 → media/<id>.mp3（--id / --limit / --all / --force）
                                 --file <mp4> --id <id>  手工投放录屏
                                 --cookies-from-browser chrome  带登录态抓视频号
  transcribe <dir>               mp3 → 文字稿（--id / --limit / --redo / --lang zh / --engine）
  deep <dir>                     输出待深读清单与提示词（基于转写稿，--limit / --chars）
  deep <dir> --apply <json>      合并深度解读结果
  build <dir>                    生成 marks.js / marks.json / stats.js
  report <dir>                   控制台摘要
  preview <dir> [--port 8712]    本地预览
  caps                           检测本机可用的抓取与转写能力
`);
}

const map = { init, ingest, add, analyze, build, report, preview, fetch: fetchAudio, transcribe: transcribeCmd, deep, caps, help };
Promise.resolve((map[cmd] || help)()).catch((e) => {
  console.error(e);
  process.exit(1);
});
