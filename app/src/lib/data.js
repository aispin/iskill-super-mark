/* 数据层：读取 build 产出的 window.SUPERMARK_DATA，建立索引与主题感知的分类色 */
export const DATA = (typeof window !== 'undefined' && window.SUPERMARK_DATA) || {
  version: 1, taxonomy: { categories: [] }, marks: [], stats: {},
};

export const marks = DATA.marks || [];
export const tax = DATA.taxonomy || { categories: [] };
export const stats = DATA.stats || {};
export const byId = new Map(marks.map((m) => [m.id, m]));

const catMap = new Map(tax.categories.map((c) => [c.id, c]));
const valMap = new Map((tax.valueTypes || []).map((v) => [v.id, v]));
const audMap = new Map((tax.audiences || []).map((v) => [v.id, v]));

/* ---------- 分类色：按主题重新配平明度与饱和度 ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return { h: 30, s: 10, l: 40 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return { r: 120, g: 120, b: 120 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: (n & 255) & 255 };
}

const tintCache = new Map();

/** 主题感知的分类主色（theme: 'dark' | 'light'） */
export function catColor(id, theme = 'dark') {
  const raw = (catMap.get(id) || {}).color || '#57534e';
  const key = (theme === 'light' ? 'l' : 'd') + raw;
  if (tintCache.has(key)) return tintCache.get(key);
  const { h, s, l } = hexToHsl(raw);
  const out = theme === 'light'
    ? hslToHex(h, clamp(s * 0.85 + 24, 42, 72), clamp(30 + (l - 26) * 0.25, 27, 42))
    : hslToHex(h, clamp(s * 0.85 + 24, 42, 72), clamp(56 + (l - 26) * 0.25, 52, 68));
  tintCache.set(key, out);
  return out;
}
export function catSoft(id, a, theme = 'dark') {
  const { r, g, b } = hexToRgb(catColor(id, theme));
  return `rgba(${r},${g},${b},${a == null ? (theme === 'light' ? 0.12 : 0.16) : a})`;
}
export const catName = (id) => (catMap.get(id) || {}).name || id;
export const valName = (id) => (valMap.get(id) || {}).name || id;
export const audName = (id) => (audMap.get(id) || {}).name || id;

/** 稳定哈希（FNV-1a）：同一条内容永远得到同一套视觉参数 */
export function hash32(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const posterGlyph = (id) => hash32(id + '#poster') % 6;

/** 海报配色：以分类色相为家族，按 id 抖动色相，保证同分类也不重样。
 *  暗色 = 深底渐变（Netflix 风）；亮色 = 淡雅低保和粉彩底 + 轻几何纹理。 */
export function posterVars(id, catId, theme = 'dark') {
  const raw = (catMap.get(catId) || {}).color || '#57534e';
  const { h, s } = hexToHsl(raw);
  const dh = (hash32(id) % 29) - 14;
  const S = clamp(s * 0.8 + 24, 34, 64);
  const c = catColor(catId, theme);
  if (theme === 'light') {
    // 白天模式：同色相家族、饱和度压到 10-28%、高明度粉彩，几何母题用 --pm 轻墨
    const h1 = (h + dh + 360) % 360;
    const S1 = clamp(s * 0.45, 10, 28);
    return {
      '--p1': hslToHex(h1, S1, 91),
      '--p2': hslToHex((h1 + 26) % 360, clamp(S1 + 6, 14, 32), 80),
      '--pm': 'rgba(0,0,0,0.08)',
      '--cat': c, '--cat-soft': catSoft(catId, undefined, theme), '--cat-line': catSoft(catId, 0.42, theme),
    };
  }
  const p1 = hslToHex((h + dh + 360) % 360, S, 23);
  const p2 = hslToHex((h + dh + 26) % 360, clamp(S + 8, 34, 68), 48);
  return { '--p1': p1, '--p2': p2, '--pm': 'rgba(255,255,255,0.17)', '--cat': c, '--cat-soft': catSoft(catId, undefined, theme), '--cat-line': catSoft(catId, 0.42, theme) };
}
export function catVars(id, theme = 'dark') {
  return { '--cat': catColor(id, theme), '--cat-soft': catSoft(id, undefined, theme), '--cat-line': catSoft(id, 0.42, theme) };
}

export const PLAT_LABEL = {
  channels: '视频号', 'wechat-mp': '公众号', xiaohongshu: '小红书', bilibili: 'B站',
  youtube: 'YouTube', github: 'GitHub', wechat: '微信', zhihu: '知乎', douyin: '抖音',
  twitter: 'X', web: '网页', text: '文字',
};
export const PLAT_LABEL_EN = {
  channels: 'Channels', 'wechat-mp': 'WeChat MP', xiaohongshu: 'RedNote', bilibili: 'Bilibili',
  youtube: 'YouTube', github: 'GitHub', wechat: 'WeChat', zhihu: 'Zhihu', douyin: 'Douyin',
  twitter: 'X', web: 'Web', text: 'Text',
};
export const platLabel = (p, lang = 'zh') => (lang === 'en' ? PLAT_LABEL_EN[p] : PLAT_LABEL[p]) || PLAT_LABEL_EN[p] || p;

const p2 = (n) => String(n).padStart(2, '0');
export const fmtDate = (iso) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`;
};
export const fmtShort = (iso) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return `${p2(d.getMonth() + 1)}/${p2(d.getDate())}`;
};
export const fmtTime = (iso) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

export const no = (m) => String(m._no).padStart(3, '0');

/** 标题字号：按字数分档，让长短标题都能撑满海报留白 */
export function titleSize(t) {
  const n = [...String(t || '')].length;
  if (n <= 6) return 30;
  if (n <= 10) return 25;
  if (n <= 16) return 21;
  if (n <= 26) return 17;
  return 15;
}

// 检索文本：标题/摘要/要点/原文/标签/分类/行动提示
marks.forEach((m, i) => {
  m._no = marks.length - i;
  m._q = [m.title, m.summary, m.rawText, (m.keyPoints || []).join(' '),
    (m.tags || []).join(' '), (m.rawTags || []).join(' '), m.categoryName, m.subCategory, m.actionHint]
    .filter(Boolean).join(' ').toLowerCase();
});
