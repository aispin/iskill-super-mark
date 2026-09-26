/* 数据层：读取 build 产出的 window.SUPERMARK_DATA，并建立索引 */
window.SM = window.SM || {};
(function () {
  const D = window.SUPERMARK_DATA || { version: 1, taxonomy: { categories: [] }, marks: [], stats: {} };
  SM.data = D;
  SM.marks = D.marks || [];
  SM.tax = D.taxonomy || { categories: [] };
  SM.stats = D.stats || {};

  SM.byId = new Map(SM.marks.map((m) => [m.id, m]));
  const catMap = new Map(SM.tax.categories.map((c) => [c.id, c]));
  const valMap = new Map((SM.tax.valueTypes || []).map((v) => [v.id, v]));
  const audMap = new Map((SM.tax.audiences || []).map((v) => [v.id, v]));

  /* ---------- 分类色：按主题重新配平明度与饱和度 ----------
     taxonomy 里存的是低饱和暗色，直接用在暗底上会发闷、用在浅底上又太淡。
     这里按当前主题把它拉到可读区间：暗色主题提亮，浅色主题压暗。 */
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
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
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
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  const isLight = () => document.documentElement.dataset.theme === 'light';
  const tintCache = new Map();

  /** 主题感知的分类主色 */
  SM.catColor = function (id) {
    const raw = (catMap.get(id) || {}).color || '#56534E';
    const key = (isLight() ? 'l' : 'd') + raw;
    if (tintCache.has(key)) return tintCache.get(key);
    const { h, s, l } = hexToHsl(raw);
    const out = isLight()
      ? hslToHex(h, clamp(s * 0.85 + 24, 42, 72), clamp(30 + (l - 26) * 0.25, 27, 42))
      : hslToHex(h, clamp(s * 0.85 + 24, 42, 72), clamp(56 + (l - 26) * 0.25, 52, 68));
    tintCache.set(key, out);
    return out;
  };
  /** 分类色的半透明底 / 描边，用于票根与标签 */
  SM.catSoft = function (id, a) {
    const { r, g, b } = hexToRgb(SM.catColor(id));
    return `rgba(${r},${g},${b},${a == null ? (isLight() ? 0.12 : 0.16) : a})`;
  };
  SM.catName = (id) => (catMap.get(id) || {}).name || id;
  SM.valName = (id) => (valMap.get(id) || {}).name || id;
  SM.audName = (id) => (audMap.get(id) || {}).name || id;

  /** 稳定哈希（FNV-1a）：同一条内容永远得到同一套视觉参数 */
  function hash32(str) {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  SM.hash32 = hash32;

  /** 索书票根：几何图形编号（0-5） */
  SM.stampGlyph = (id) => hash32(id) % 6;
  /** 海报母题编号（0-5），与票根用不同的盐，避免同一枚图形重复出现 */
  SM.posterGlyph = (id) => hash32(id + '#poster') % 6;

  /** 海报配色：以分类色相为家族，按 id 抖动色相，保证同分类也不重样 */
  SM.posterVars = function (id, catId) {
    const raw = (catMap.get(catId) || {}).color || '#56534E';
    const { h, s } = hexToHsl(raw);
    const dh = (hash32(id) % 29) - 14;            // ±14° 家族内抖动
    const S = clamp(s * 0.8 + 24, 34, 64);
    const p1 = hslToHex((h + dh + 360) % 360, S, 23);          // 深色端
    const p2 = hslToHex((h + dh + 26) % 360, clamp(S + 8, 34, 68), 48); // 亮色端
    return `--p1:${p1};--p2:${p2};--pm:rgba(255,255,255,0.17);${SM.catVars(catId)}`;
  };
  /** 一条目要注入的 CSS 变量串 */
  SM.catVars = function (id) {
    const c = SM.catColor(id);
    return `--cat:${c};--cat-soft:${SM.catSoft(id)};--cat-line:${SM.catSoft(id, 0.42)}`;
  };

  SM.PLAT_LABEL = {
    channels: '视频号', 'wechat-mp': '公众号', xiaohongshu: '小红书', bilibili: 'B站',
    youtube: 'YouTube', github: 'GitHub', wechat: '微信', zhihu: '知乎', douyin: '抖音',
    twitter: 'X', web: '网页', text: '文字',
  };
  SM.platLabel = (p) => SM.PLAT_LABEL[p] || p;

  const p2 = (n) => String(n).padStart(2, '0');
  SM.fmtDate = (iso) => {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`;
  };
  SM.fmtShort = (iso) => {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    return `${p2(d.getMonth() + 1)}/${p2(d.getDate())}`;
  };
  SM.fmtTime = (iso) => {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  };

  // 检索文本：标题/摘要/要点/原文/标签/分类/行动提示
  SM.marks.forEach((m) => {
    m._q = [m.title, m.summary, m.rawText, (m.keyPoints || []).join(' '),
      (m.tags || []).join(' '), (m.rawTags || []).join(' '), m.categoryName, m.subCategory, m.actionHint]
      .filter(Boolean).join(' ').toLowerCase();
  });
})();
