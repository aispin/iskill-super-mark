// 转写层（super-mark 适配层）：引擎已抽离到 iskill-media-transcribe（见 engine.mjs）。
// 引擎优先级、VoiceBox MCP audio_path 通道、重试策略等细节全在 skill 仓库维护。
import { engineLib } from './engine.mjs';

/**
 * 转写一个 mp3。转发给引擎；为 super-mark 补一个 subtitleTimed 标记
 * （引擎只回纯文本时 srt 只能单块时间轴，deep/展示侧可用它提示）。
 */
export async function transcribe(file, opts = {}) {
  const eng = await engineLib();
  const r = await eng.asr.transcribe(file, opts);
  if (r.ok) return { ...r, subtitleTimed: !r.noSegments };
  return r;
}

/** 能力探测（VoiceBox / whisper CLI）—— 直接转发 */
export async function probeAsr() {
  const eng = await engineLib();
  return eng.asr.probeAsr();
}
