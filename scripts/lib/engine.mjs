// 引擎加载器：把「下载/抽音轨/转写」引擎指向 iskill-media-transcribe（唯一源头）。
//
// 查找顺序：
//   1) 环境变量 MEDIA_TRANSCRIBE_HOME（指向 skill 仓库根）
//   2) 兄弟目录 ../../../iskill-media-transcribe（ISkills/ 平铺约定）
//
// 引擎升级只改 skill 仓库一处；本文件不复制任何引擎代码。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let cached = null;

export async function engineLib() {
  if (cached) return cached;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cands = [
    process.env.MEDIA_TRANSCRIBE_HOME,
    path.resolve(here, '../../../iskill-media-transcribe'),
  ].filter(Boolean);

  const errs = [];
  for (const root of cands) {
    try {
      const u = (p) => pathToFileURL(path.join(root, 'scripts', 'lib', p)).href;
      const [dl, au, asr] = await Promise.all([
        import(u('download.mjs')),
        import(u('audio.mjs')),
        import(u('asr.mjs')),
      ]);
      cached = { download: dl, audio: au, asr, root };
      return cached;
    } catch (e) {
      errs.push(`${root}: ${e.message.slice(0, 120)}`);
    }
  }
  throw new Error(
    '找不到转写引擎 iskill-media-transcribe。\n' +
    '修复方式（任选其一）：\n' +
    '  1) 把它放在兄弟目录：ISkills/iskill-media-transcribe\n' +
    '  2) 设置环境变量 MEDIA_TRANSCRIBE_HOME 指向该仓库根\n' +
    '尝试记录：' + errs.join(' | ')
  );
}

export function engineRootSync() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cands = [
    process.env.MEDIA_TRANSCRIBE_HOME,
    path.resolve(here, '../../../iskill-media-transcribe'),
  ].filter(Boolean);
  return cands.find((r) => fs.existsSync(path.join(r, 'scripts', 'lib', 'audio.mjs'))) || null;
}
