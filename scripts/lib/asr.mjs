// 转写层：本地 mp3 → 文字稿
//
// 引擎按「本机已有即用」的顺序探测，全部离线、不外传音频：
//   1) VoiceBox 本地 REST（http://127.0.0.1:17493/transcribe，底层 Whisper，中文好）
//   2) mlx_whisper（Apple Silicon 上最快的 Whisper）
//   3) whisper.cpp 的 whisper-cli
//   4) openai-whisper 的 whisper 命令
//   5) VoiceStudio 本地 MCP（http://localhost:3900/mcp，注意其默认 ASR 多为英文模型，中文不稳）
// 都没有时不报错，只返回 null，交由上层提示「先装一个转写引擎」。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execFile } from 'node:child_process';
import { createRequire } from 'node:module';

const run = (bin, argv, opts = {}) => new Promise((resolve) => {
  execFile(bin, argv, { maxBuffer: 256 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
    resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '', code: err?.code ?? 0 });
  });
});

const which = (bin) => {
  try { return execFileSync('/usr/bin/which', [bin], { encoding: 'utf8' }).trim() || null; } catch { return null; }
};
const tryWhich = (bins) => bins.map(which).find(Boolean) || null;

/* ---------------- VoiceBox 本地 MCP ---------------- */
// VoiceBox 在 http://127.0.0.1:17493 同时提供 REST 与 MCP（Streamable HTTP）。
// REST 的 /transcribe 只接受 multipart 上传、且对 Node 上传的大文件不稳定；
// MCP 的 voicebox.transcribe 支持 audio_path（直接读本地文件，无需上传），
// 因此这里走 MCP。

const VOICEBOX_URL = process.env.VOICEBOX_URL || 'http://127.0.0.1:17493';
const VOICEBOX_MCP = `${VOICEBOX_URL}/mcp`;
const VOICEBOX_CLIENT_ID = process.env.VOICEBOX_CLIENT_ID || 'super-mark';
let vbSession = null;

export async function voiceboxHealthy() {
  try {
    const r = await fetch(`${VOICEBOX_URL}/health`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j || { status: 'ok' };
  } catch {
    return null;
  }
}

async function vbCall(method, params, { timeoutMs = 900000 } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'X-Voicebox-Client-Id': VOICEBOX_CLIENT_ID,
  };
  if (vbSession) headers['mcp-session-id'] = vbSession;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(VOICEBOX_MCP, {
      method: 'POST', headers, signal: ctrl.signal,
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now() % 100000, method, params }),
    });
    const sid = res.headers.get('mcp-session-id');
    if (sid) vbSession = sid;
    const text = await res.text();
    // Streamable HTTP 可能用 SSE 或纯 JSON 返回
    const line = text.split('\n').find((l) => l.startsWith('data:'));
    const body = line ? line.slice(5).trim() : text.trim();
    try { return JSON.parse(body); } catch { return null; }
  } finally {
    clearTimeout(timer);
  }
}

async function vbInit() {
  if (vbSession) return true;
  try {
    const r = await vbCall('initialize', {
      protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'super-mark', version: '1.0' },
    }, { timeoutMs: 10000 });
    if (!r?.result) return false;
    await vbCall('notifications/initialized', {}).catch(() => {});
    return true;
  } catch { return false; }
}

/**
 * 调 VoiceBox MCP 的 voicebox.transcribe，直接传本地 audio_path（不上传、无大小限制担忧）。
 */
async function viaVoiceBox(file, language) {
  if (!(await voiceboxHealthy())) {
    return { ok: false, error: `连不上 ${VOICEBOX_URL}（VoiceBox 没在运行？）` };
  }
  if (!(await vbInit())) return { ok: false, error: 'VoiceBox MCP 握手失败' };
  const model = process.env.VOICEBOX_MODEL || 'turbo';
  const args = { audio_path: file, model };
  if (language) args.language = language;
  const r = await vbCall('tools/call', { name: 'voicebox.transcribe', arguments: args }, { timeoutMs: 900000 });
  const content = r?.result?.content;
  if (!content?.length) {
    const err = r?.error?.message || JSON.stringify(r).slice(0, 160);
    return { ok: false, error: err };
  }
  const raw = content.map((c) => c.text || '').join('\n').trim();
  const parsed = (() => { try { return JSON.parse(raw); } catch { return null; } })();
  const j = parsed || {};
  if (j.detail?.message?.toLowerCase().includes('download')) {
    return { ok: false, error: `${j.detail.message}（首次使用会下载 Whisper 模型，稍等重试）` };
  }
  if (j.text == null) return { ok: false, error: raw.slice(0, 160) || '未返回文本' };
  return { ok: true, text: String(j.text).trim(), engine: `VoiceBox/${model}`, lang: j.language, duration: j.duration };
}

/* ---------------- VoiceStudio MCP 客户端（兜底） ---------------- */

const VS_URL = process.env.VOICESTUDIO_MCP || 'http://localhost:3900/mcp';
let vsSession = null;

function parseSse(text) {
  const line = text.split('\n').find((l) => l.startsWith('data:'));
  if (!line) return null;
  try { return JSON.parse(line.slice(5).trim()); } catch { return null; }
}

async function vsCall(method, params, { timeoutMs = 900000 } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (vsSession) headers['mcp-session-id'] = vsSession;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(VS_URL, {
      method: 'POST', headers, signal: ctrl.signal,
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now() % 100000, method, params }),
    });
    const sid = res.headers.get('mcp-session-id');
    if (sid) vsSession = sid;
    const text = await res.text();
    return parseSse(text) || (text.trim().startsWith('{') ? JSON.parse(text) : null);
  } finally {
    clearTimeout(timer);
  }
}

async function vsInit() {
  if (vsSession) return true;
  try {
    const r = await vsCall('initialize', {
      protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'super-mark', version: '1.0' },
    }, { timeoutMs: 10000 });
    if (!r?.result) return false;
    await vsCall('notifications/initialized', {}).catch(() => {});
    return true;
  } catch { return false; }
}

export async function voicestudioHealthy() {
  try {
    if (!(await vsInit())) return null;
    const r = await vsCall('tools/call', { name: 'check_health', arguments: {} }, { timeoutMs: 15000 });
    return r?.result?.content?.[0]?.text || 'ok';
  } catch { return null; }
}

function parseLoose(txt) {
  const cleaned = String(txt).trim();
  try { return JSON.parse(cleaned); } catch { /* 继续 */ }
  const asJson = cleaned
    .replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3')
    .replace(/:\s*'((?:[^'\\]|\\.)*)'/g, (_, v) => `:"${v.replace(/"/g, '\\"')}"`);
  try { return JSON.parse(asJson); } catch { /* 继续 */ }
  const err = /'error':\s*'([^']*)'/.exec(cleaned);
  if (err) return { error: err[1] };
  const text = /'text':\s*'([^']*)'/.exec(cleaned);
  if (text) return { text: text[1] };
  return null;
}

/** 调 VoiceStudio 的 transcribe（audio_base64 通道，绕过文件路径安全闸） */
async function vsTranscribeBuffer(buf, language) {
  const args = { audio_base64: buf.toString('base64') };
  if (language) args.language = language;
  const r = await vsCall('tools/call', { name: 'transcribe', arguments: args });
  const raw = (r?.result?.content || []).map((c) => c.text || '').join('\n').trim();
  if (!raw) return { ok: false, error: '空响应' };
  const parsed = parseLoose(raw);
  if (parsed && typeof parsed === 'object') {
    if (parsed.error || parsed.detail) return { ok: false, error: String(parsed.error || parsed.detail).slice(0, 200) };
    const out = parsed.text || parsed.transcript || parsed.result;
    if (out) return { ok: true, text: String(out).trim(), lang: parsed.language, engine: parsed.engine };
    return { ok: false, error: '未返回文本' };
  }
  return { ok: true, text: raw };
}

async function viaVoiceStudio(file, language, onProgress) {
  if (!(await vsInit())) return { ok: false, error: `连不上 ${VS_URL}（VoiceStudio 没在运行？）` };
  const size = fs.statSync(file).size;
  const CAP = Number(process.env.SM_ASR_CHUNK_MAX || 6 * 1024 * 1024);
  try {
    if (size <= CAP) return await vsTranscribeBuffer(fs.readFileSync(file), language);
    const { findFfmpeg } = await import('./audio.mjs');
    const ff = findFfmpeg();
    if (!ff) return { ok: false, error: '文件过大且缺少 ffmpeg，无法分片' };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-asr-'));
    const pat = path.join(tmp, 'seg-%03d.mp3');
    await run(ff, ['-y', '-loglevel', 'error', '-i', file, '-f', 'segment', '-segment_time', '300', '-c', 'copy', pat], { timeout: 600000 });
    const segs = fs.readdirSync(tmp).filter((f) => f.endsWith('.mp3')).sort();
    if (!segs.length) return { ok: false, error: 'ffmpeg 分片失败' };
    const parts = [];
    for (let i = 0; i < segs.length; i++) {
      onProgress?.(i + 1, segs.length);
      const r = await vsTranscribeBuffer(fs.readFileSync(path.join(tmp, segs[i])), language);
      if (r.ok) parts.push(r.text);
      else if (i === 0) return r;
    }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
    return parts.length ? { ok: true, text: parts.join('\n') } : { ok: false, error: '全部分片都失败' };
  } catch (e) {
    return { ok: false, error: `调用异常：${e.message}` };
  }
}

/* ---------------- 本地 CLI 后端 ---------------- */

export function findWhisperCli() {
  const cands = [
    process.env.WHISPER,
    tryWhich(['mlx_whisper', 'mlx-whisper', 'whisper-cli', 'whisper-cpp', 'whisper']),
  ].filter(Boolean);
  return cands[0] || null;
}

async function viaWhisperCli(bin, file, language, outDir) {
  const base = path.join(outDir, path.basename(file).replace(/\.[^.]+$/, ''));
  const isMlx = /mlx/i.test(path.basename(bin));
  const argv = isMlx
    ? ['--model', process.env.WHISPER_MODEL || 'mlx-community/whisper-large-v3-turbo',
       '--language', language, '--output-dir', outDir, '--output-format', 'txt', file]
    : ['-m', process.env.WHISPER_MODEL || 'models/ggml-large-v3.bin',
       '-l', language, '-otxt', '-of', base, file];
  const r = await run(bin, argv, { timeout: 1800000 });
  const guess = [`${base}.txt`, path.join(outDir, `${path.basename(file).replace(/\.[^.]+$/, '')}.txt`)];
  const hit = guess.find((p) => fs.existsSync(p));
  if (hit) return fs.readFileSync(hit, 'utf8').trim();
  if (r.ok) return (r.stdout || '').trim();
  return null;
}

/* ---------------- 能力探测 ---------------- */

export async function probeAsr() {
  const voicebox = await voiceboxHealthy();
  const vs = await voicestudioHealthy();
  const cli = findWhisperCli();
  return {
    voicebox: voicebox ? { url: VOICEBOX_URL, status: String(voicebox.status || 'ok').slice(0, 40) } : null,
    voicestudio: vs ? { url: VS_URL, status: String(vs).slice(0, 80) } : null,
    whisperCli: cli,
    ready: !!(voicebox || vs || cli),
  };
}

/* ---------------- 入口 ---------------- */

/**
 * 转写一个音频文件。优先本地 VoiceBox（中文好），其次 whisper CLI，最后 VoiceStudio。
 * @returns {{ok:boolean, text?:string, engine?:string, reason?:string}}
 */
export async function transcribe(file, { language = 'zh', outDir, engine, onProgress } = {}) {
  if (!fs.existsSync(file)) return { ok: false, reason: `找不到音频：${file}` };
  const dir = outDir || path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });

  const want = engine || 'auto';
  const reasons = [];

  if (want === 'auto' || want === 'voicebox') {
    const r = await viaVoiceBox(file, language).catch((e) => ({ ok: false, error: e.message }));
    if (r?.ok) return { ok: true, text: r.text, engine: r.engine, duration: r.duration };
    reasons.push(`VoiceBox：${r?.error || '不可用'}`);
    if (want === 'voicebox') return { ok: false, reason: reasons.join('；') };
  }

  const cli = findWhisperCli();
  if (cli && (want === 'auto' || want === 'whisper')) {
    const t = await viaWhisperCli(cli, file, language, dir).catch((e) => { reasons.push(`${path.basename(cli)}：${e.message}`); return null; });
    if (t) return { ok: true, text: t, engine: path.basename(cli) };
    if (want === 'whisper') return { ok: false, reason: reasons.join('；') };
  } else if (!cli) {
    reasons.push('未找到 whisper CLI（装 mlx-whisper 中文效果最好）');
  }

  if (want === 'auto' || want === 'voicestudio') {
    const r = await viaVoiceStudio(file, language, onProgress);
    if (r?.ok) return { ok: true, text: r.text, engine: 'VoiceStudio' };
    reasons.push(`VoiceStudio：${r?.error || '不可用（且其默认 ASR 多为英文模型，中文不稳）'}`);
    if (want === 'voicestudio') return { ok: false, reason: reasons.join('；') };
  }

  return { ok: false, reason: reasons.join('；') || '没有可用的转写引擎' };
}
