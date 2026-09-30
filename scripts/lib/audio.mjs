// 媒体层（super-mark 适配层）：引擎已抽离到 iskill-media-transcribe（见 engine.mjs）。
//
// 这里只保留 super-mark 特有的编排：
//   - inbox 手工投放认领（文件名以条目 id 开头）
//   - 按条目 id 命名 mp3（media/<id>.mp3）
//   - URL 下载后抽音轨，mp4 默认抽完即删（--keep-video 保留到 media/video/）
//   - probeCapabilities：super-mark 视角的体检（yt-dlp/视频号插件/ffmpeg）
//
// 原实现的浏览器嗅探(sniff)/puppeteer/虚拟声卡等已随引擎抽离一并移除：
// 嗅探对视频号(blob:)零价值且曾是整批抓取崩溃的元凶。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { engineLib } from './engine.mjs';

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

/** inbox 手工投放：按 id 前缀认领 */
export function claimInboxFile(dir, id) {
  const inbox = path.join(dir, 'inbox');
  if (!fs.existsSync(inbox)) return null;
  const files = listMediaFiles(inbox);
  return files.find((f) => path.basename(f).startsWith(id)) || null;
}

/* ---------------- 能力体检（super-mark 视角） ---------------- */

export function findYtDlp() {
  const cands = [
    process.env.YTDLP,
    '/Users/lv/.workbuddy/binaries/python/envs/default/bin/yt-dlp',
  ].filter(Boolean);
  return cands.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

// 探测链：PATH → Apple Silicon brew → Intel brew（Homebrew 默认路径随架构不同）
export function findFfmpeg() {
  let which = null;
  try { which = execFileSync('/usr/bin/which', ['ffmpeg'], { encoding: 'utf8' }).trim() || null; } catch { /* ignore */ }
  const cands = [which, '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].filter(Boolean);
  return cands.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

export function probeCapabilities() {
  const yt = findYtDlp();
  let version = null;
  let plugins = [];
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
    engineRoot: null, // 填充见 probeEngineRoot()
  };
}

export async function probeEngineRoot() {
  const eng = await engineLib();
  return eng.root;
}

/* ---------------- 统一入口：为一条收藏拿到 media/<id>.mp3 ---------------- */

/**
 * @param {object} it  super-mark 条目（{id, url, ...}）
 * @param {string} dir 实例目录
 * @param {object} opts {force, cookiesFile, cookiesFromBrowser, weixin, keepVideo, retries}
 * @returns {{ok:boolean, file?:string, method?:string, reason?:string}}
 */
export async function acquireAudio(item, dir, opts = {}) {
  const mediaDir = ensureDir(path.join(dir, 'media'));
  const outFile = path.join(mediaDir, `${item.id}.mp3`);
  if (fs.existsSync(outFile) && !opts.force) {
    return { ok: true, file: outFile, method: 'cache' };
  }

  const eng = await engineLib();

  // inbox 优先于网络：用户已手动放好（录屏 mp4 / 音频），别白跑网络
  const inboxFile = claimInboxFile(dir, item.id);
  if (inboxFile) {
    const r = await eng.audio.extractAudio(inboxFile, outFile, opts);
    return r.ok ? { ok: true, file: outFile, method: 'inbox' } : { ok: false, reason: r.reason };
  }

  if (!item.url) return { ok: false, reason: '这条没有链接，无法抓音频（纯文本收藏）' };

  // URL → 临时 mp4 → 抽 mp3 →（默认）删 mp4
  const tmp = ensureDir(path.join(dir, '.tmp-video'));
  // cookie 优先级：显式指定 > sph 自动走元宝(WEIXIN_COOKIE_FILE) > 无登录态
  const explicitCookies = opts.cookiesFile || opts.cookiesFromBrowser;
  const weixin = explicitCookies ? false : (opts.weixin || /weixin\.qq\.com\/sph|channels\.weixin/i.test(item.url));
  const dl = await eng.download.downloadUrl(item.url, tmp, { ...opts, weixin });
  if (!dl.ok) return { ok: false, reason: dl.reason };

  const ex = await eng.audio.extractAudio(dl.file, outFile, opts);
  if (opts.keepVideo) {
    const dst = path.join(ensureDir(path.join(mediaDir, 'video')), path.basename(dl.file));
    try { fs.renameSync(dl.file, dst); } catch { /* ignore */ }
  } else {
    try { fs.unlinkSync(dl.file); } catch { /* ignore */ }
  }
  return ex.ok ? { ok: true, file: outFile, method: 'download' } : { ok: false, reason: ex.reason };
}

/** 单条手工导入：fetch --file <媒体文件> --id <条目id> */
export async function importAudioFile(srcFile, dir, id) {
  if (!fs.existsSync(srcFile)) return { ok: false, reason: `找不到文件：${srcFile}` };
  const eng = await engineLib();
  const outFile = path.join(ensureDir(path.join(dir, 'media')), `${id}.mp3`);
  const r = await eng.audio.extractAudio(srcFile, outFile);
  return r.ok ? { ok: true, file: outFile, method: 'import' } : { ok: false, reason: r.reason };
}

/** 时长（秒）—— 转发给引擎实现 */
export async function audioDuration(file) {
  const eng = await engineLib();
  return eng.audio.mediaDuration(file);
}
