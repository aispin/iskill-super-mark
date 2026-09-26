// 媒体层：把「一条收藏」变成本地 mp3
//
// 目标：视频号/短视频这类只有链接的收藏，先拿到音频，才能做真正的深度分析。
// 按可靠性从高到低串成一条链，每一步都可能失败，失败就退到下一步：
//
//   1) yt-dlp（含 yt-dlp-patch 插件，支持 weixin.qq.com/sph 视频号）
//   2) 无头浏览器嗅探媒体直链（.m3u8 / .mp4 / .m4a）→ 交给 ffmpeg 或 yt-dlp
//   3) inbox/ 手工投放：用户自己录屏成 mp4 丢进 inbox/，自动抽音轨
//   4) 系统音频录制（需要 BlackHole / Loopback 之类的虚拟声卡，可选高级方案）
//
// 第 3 步虽然「土」，但零依赖、零授权、成功率最高，是本机最稳的兜底。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execFile } from 'node:child_process';
import { createRequire } from 'node:module';

const which = (bin) => {
  try {
    return execFileSync('/usr/bin/which', [bin], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
};

const tryWhich = (bins) => bins.map((b) => which(b)).find(Boolean) || null;

/* ---------------- 引擎探测 ---------------- */

export function findYtDlp() {
  const cands = [
    process.env.YTDLP,
    '/Users/lv/.workbuddy/binaries/python/envs/default/bin/yt-dlp',
    which('yt-dlp'),
  ].filter(Boolean);
  return cands.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

export function findFfmpeg() {
  return tryWhich(['ffmpeg']) || (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : null);
}

function loadPuppeteer() {
  const roots = [
    process.env.PUPPETEER_ROOT,
    '/Users/lv/.workbuddy/binaries/node/workspace',
    process.cwd(),
  ].filter(Boolean);
  for (const r of roots) {
    try {
      const req = createRequire(path.join(r, '__probe__.cjs'));
      return req('puppeteer');
    } catch { /* 换下一个 */ }
  }
  return null;
}

function findChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const base = path.join(os.homedir(), '.cache/puppeteer/chrome');
  if (!fs.existsSync(base)) return null;
  for (const dir of fs.readdirSync(base)) {
    const p = path.join(base, dir, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** 虚拟声卡（用于系统音频录制兜底） */
export function findVirtualAudio() {
  const hal = '/Library/Audio/Plug-Ins/HAL';
  if (!fs.existsSync(hal)) return null;
  const hit = fs.readdirSync(hal).find((d) => /blackhole|loopback|soundflower|existential/i.test(d));
  return hit ? hit.replace(/\.driver$/, '') : null;
}

/** 能力体检：把「这台机器现在能做到哪一步」讲清楚 */
export function probeCapabilities() {
  const yt = findYtDlp();
  let plugins = [];
  let version = null;
  if (yt) {
    try { version = execFileSync(yt, ['--version'], { encoding: 'utf8' }).trim(); } catch { /* ignore */ }
    try {
      const list = execFileSync(yt, ['--list-extractors'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      plugins = list.split('\n').filter((l) => /weixin|channels|douyin|finder/i.test(l)).slice(0, 12);
    } catch { /* ignore */ }
  }
  return {
    ytdlp: yt,
    ytdlpVersion: version,
    ytdlpPlugins: plugins,
    weixinSupport: plugins.some((p) => /weixin|channels|finder/i.test(p)),
    ffmpeg: findFfmpeg(),
    browser: findChrome(),
    puppeteer: !!loadPuppeteer(),
    virtualAudio: findVirtualAudio(),
  };
}

/* ---------------- 工具 ---------------- */

const run = (bin, argv, opts = {}) => new Promise((resolve) => {
  execFile(bin, argv, { maxBuffer: 64 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
    resolve({ ok: !err, code: err?.code ?? 0, stdout: stdout || '', stderr: stderr || '' });
  });
});

const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|opus|mp4|mov|mkv|webm)$/i;

function listMediaFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (AUDIO_EXT.test(e.name)) out.push(p);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

/* ---------------- 1) yt-dlp ---------------- */

async function viaYtDlp(ytdlp, item, outTmp, opts) {
  const tmpl = path.join(outTmp, `${item.id}.%(ext)s`);
  const argv = [
    '--no-playlist', '--no-warnings', '--quiet', '--no-progress',
    '-x', '--audio-format', 'mp3', '--audio-quality', '4',
    '-o', tmpl,
  ];
  // 非交互 shell 里 PATH 常常没有 Homebrew，必须把 ffmpeg 位置显式告诉 yt-dlp，
  // 否则音频抽不出来（报 "ffprobe and ffmpeg not found"）。
  const ff = findFfmpeg();
  if (ff) argv.push('--ffmpeg-location', path.dirname(ff));
  if (opts.cookiesFromBrowser) argv.push('--cookies-from-browser', opts.cookiesFromBrowser);
  if (opts.cookiesFile) argv.push('--cookies', opts.cookiesFile);
  argv.push(item.url);

  const r = await run(ytdlp, argv, {
    timeout: opts.timeoutMs || 600000,
    env: { ...process.env, PATH: [ff ? path.dirname(ff) : '', '/opt/homebrew/bin', process.env.PATH || ''].filter(Boolean).join(':') },
  });
  const produced = listMediaFiles(outTmp).find((f) => path.basename(f).startsWith(item.id));
  return { ok: r.ok && !!produced, file: produced, log: (r.stderr || r.stdout || '').slice(-600) };
}

/* ---------------- 2) 无头浏览器嗅探直链 ---------------- */

/**
 * 打开页面，监听网络请求，找出可能承载媒体的直链。
 * 视频号页面里的 <video> 通常是 blob:，拿不到直链；但很多平台会直接发 .m3u8 / .mp4。
 */
export async function sniffMediaUrl(url, { timeoutMs = 25000, headless = true } = {}) {
  const puppeteer = loadPuppeteer();
  const exe = findChrome();
  if (!puppeteer || !exe) return { ok: false, reason: '缺少 puppeteer 或 Chrome for Testing' };

  const browser = await puppeteer.launch({ executablePath: exe, headless, args: ['--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    const hits = new Map();
    const note = (u, type) => {
      if (!u || u.startsWith('blob:') || u.startsWith('data:')) return;
      if (!/\.(m3u8|mp4|m4a|mp3|aac|ts)(\?|$)/i.test(u)) return;
      if (!hits.has(u)) hits.set(u, type);
    };
    page.on('request', (r) => note(r.url(), r.resourceType()));
    page.on('response', (r) => {
      const ct = (r.headers()['content-type'] || '').toLowerCase();
      if (/video|audio|mpegurl|octet-stream/.test(ct)) note(r.url(), ct);
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    // 给播放器一点时间发起请求
    await new Promise((r) => setTimeout(r, 4000));
    const dom = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('video, audio, source').forEach((el) => { if (el.src) out.push(el.src); });
      return out;
    });
    dom.forEach((u) => note(u, 'dom'));

    const list = [...hits.keys()];
    // .m3u8 优先，其次体积线索最长的 mp4
    list.sort((a, b) => (/\.m3u8/i.test(b) ? 1 : 0) - (/\.m3u8/i.test(a) ? 1 : 0));
    return { ok: list.length > 0, urls: list, page: await page.url() };
  } catch (e) {
    return { ok: false, reason: e.message };
  } finally {
    await browser.close().catch(() => {});
  }
}

/* ---------------- 3) inbox 手工投放 ---------------- */

/** 用户把录屏/下载的媒体丢进 <dir>/inbox/，按 id 前缀认领 */
export function claimInboxFile(dir, id) {
  const inbox = path.join(dir, 'inbox');
  if (!fs.existsSync(inbox)) return null;
  const files = listMediaFiles(inbox);
  const hit = files.find((f) => path.basename(f).startsWith(id)) || (files.length === 1 ? files[0] : null);
  return hit || null;
}

/* ---------------- 统一入口 ---------------- */

/**
 * 为一条收藏拿到本地 mp3。
 * @returns {{ok:boolean, file?:string, method?:string, sniffed?:string[], reason?:string}}
 */
export async function acquireAudio(item, dir, opts = {}) {
  const mediaDir = ensureDir(path.join(dir, 'media'));
  const outFile = path.join(mediaDir, `${item.id}.mp3`);
  if (fs.existsSync(outFile) && !opts.force) {
    return { ok: true, file: outFile, method: 'cache' };
  }

  // 3) inbox 优先于网络：用户已经手动放好了，别白跑一趟
  const inboxFile = claimInboxFile(dir, item.id);
  if (inboxFile) {
    const ff = findFfmpeg();
    if (!ff) return { ok: false, reason: `inbox 有 ${path.basename(inboxFile)} 但缺少 ffmpeg` };
    const r = await run(ff, ['-y', '-i', inboxFile, '-vn', '-acodec', 'libmp3lame', '-q:a', '4', outFile]);
    if (r.ok && fs.existsSync(outFile)) return { ok: true, file: outFile, method: 'inbox' };
    return { ok: false, reason: 'inbox 文件转码失败：' + (r.stderr || '').slice(-200) };
  }

  if (!item.url) return { ok: false, reason: '这条没有链接，无法抓音频（纯文本收藏）' };

  const tmp = ensureDir(path.join(dir, '.tmp-audio'));
  const ytdlp = findYtDlp();

  // 0) 直链（用户或嗅探给的）直接下
  if (item.mediaUrl) {
    const r = await downloadDirect(item.mediaUrl, outFile);
    if (r.ok) return { ok: true, file: outFile, method: 'direct' };
  }

  // 1) yt-dlp
  if (ytdlp) {
    const r = await viaYtDlp(ytdlp, item, tmp, opts);
    if (r.ok && r.file) {
      fs.copyFileSync(r.file, outFile);
      return { ok: true, file: outFile, method: 'yt-dlp' };
    }
    var ytLog = r.log;
  }

  // 2) 浏览器嗅探
  const sniff = await sniffMediaUrl(item.url, { timeoutMs: opts.sniffTimeoutMs || 25000 });
  if (sniff.ok) {
    for (const u of sniff.urls.slice(0, 3)) {
      const r = await downloadDirect(u, outFile);
      if (r.ok) return { ok: true, file: outFile, method: 'sniff', sniffed: sniff.urls };
    }
  }

  return {
    ok: false,
    sniffed: sniff.urls || [],
    reason: [
      ytdlp ? '' : '未安装 yt-dlp',
      '/'.concat('yt-dlp 解析失败'),
      sniff.ok ? '嗅探到直链但下载失败' : `浏览器嗅探失败（${sniff.reason || '无媒体请求'}）`,
    ].filter(Boolean).join('；'),
  };
}

/** m3u8 / 直链媒体 → mp3 */
export async function downloadDirect(mediaUrl, outFile) {
  const ff = findFfmpeg();
  if (!ff) return { ok: false };
  const r = await run(ff, [
    '-y', '-loglevel', 'error',
    '-user_agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    '-i', mediaUrl, '-vn', '-acodec', 'libmp3lame', '-q:a', '4', outFile,
  ], { timeout: 300000 });
  return { ok: r.ok && fs.existsSync(outFile), log: (r.stderr || '').slice(-300) };
}

/** 已归档音频的时长（秒） */
export async function audioDuration(file) {
  const ff = findFfmpeg();
  if (!ff) return 0;
  const r = await run(ff, ['-i', file, '-f', 'null', '-']);
  const m = /Duration: (\d+):(\d+):(\d+)/.exec(r.stderr || '');
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * 把用户手动给的媒体文件（录屏 mp4 / 已下好的 m4a）转成 media/<id>.mp3。
 * 这是视频号最稳的一条路：内容本来就在微信里，录个屏丢进来即可。
 */
export async function importAudioFile(srcFile, dir, id) {
  if (!fs.existsSync(srcFile)) return { ok: false, reason: `找不到文件：${srcFile}` };
  const ff = findFfmpeg();
  if (!ff) return { ok: false, reason: '缺少 ffmpeg，无法抽取音轨' };
  const outFile = path.join(ensureDir(path.join(dir, 'media')), `${id}.mp3`);
  const r = await run(ff, ['-y', '-loglevel', 'error', '-i', srcFile,
    '-vn', '-acodec', 'libmp3lame', '-q:a', '4', outFile], { timeout: 600000 });
  if (r.ok && fs.existsSync(outFile)) return { ok: true, file: outFile, method: 'import' };
  return { ok: false, reason: (r.stderr || 'ffmpeg 转码失败').slice(-200) };
}
