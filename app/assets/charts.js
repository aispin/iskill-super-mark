/* 手写 SVG 图表：零依赖，全部走 CSS 变量以适配亮/暗主题 */
window.SM = window.SM || {};
(function () {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** 竖柱状图：按月收藏量 */
  function bars(items, { h = 150, label = '' } = {}) {
    if (!items.length) return '';
    const gap = 8;
    const bw = 26;
    const w = items.length * (bw + gap);
    const max = Math.max(...items.map((d) => d.count), 1);
    const bars = items.map((d, i) => {
      const bh = Math.max(2, Math.round((d.count / max) * (h - 28)));
      const x = i * (bw + gap);
      const y = h - 22 - bh;
      return `<g>
        <rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="var(--accent)" opacity="0.85"/>
        <text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--muted)">${d.count}</text>
        <text x="${x + bw / 2}" y="${h - 6}" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--muted)">${esc(d.month.slice(2))}</text>
      </g>`;
    }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="${esc(label)}">${bars}</svg>`;
  }

  /** 环形图：分类占比 */
  function donut(items, total, { size = 168 } = {}) {
    if (!items.length) return '';
    const r = size / 2 - 14;
    const cx = size / 2;
    const C = 2 * Math.PI * r;
    let acc = 0;
    const segs = items.map((d) => {
      const frac = d.count / (total || 1);
      const len = frac * C;
      const s = `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${d.color}"
        stroke-width="16" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 ${cx} ${cx})"/>`;
      acc += len;
      return s;
    }).join('');
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="分类占比">
      ${segs}
      <text x="${cx}" y="${cx - 2}" text-anchor="middle" font-size="28" font-family="var(--font-mono)" fill="var(--ink)">${total}</text>
      <text x="${cx}" y="${cx + 18}" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--muted)">条收藏</text>
    </svg>`;
  }

  /** 热力矩阵：星期 × 小时 的收藏密度 */
  function heat(matrix, { cell = 13, gap = 2 } = {}) {
    const flat = matrix.flat();
    const max = Math.max(...flat, 1);
    const w = 24 * (cell + gap) + 26;
    const h = 7 * (cell + gap) + 18;
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    let out = '';
    for (let d = 0; d < 7; d++) {
      out += `<text x="0" y="${d * (cell + gap) + cell}" font-size="10" font-family="var(--font-mono)" fill="var(--muted)">${days[d]}</text>`;
      for (let hr = 0; hr < 24; hr++) {
        const v = matrix[d][hr];
        const op = v ? 0.15 + 0.85 * (v / max) : 0.06;
        out += `<rect x="${26 + hr * (cell + gap)}" y="${d * (cell + gap)}" width="${cell}" height="${cell}"
          fill="var(--accent)" opacity="${op.toFixed(2)}"><title>${days[d]} ${hr}:00 · ${v} 条</title></rect>`;
      }
    }
    [0, 6, 12, 18, 23].forEach((hr) => {
      out += `<text x="${26 + hr * (cell + gap)}" y="${h - 4}" font-size="9" font-family="var(--font-mono)" fill="var(--muted)">${hr}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="收藏时间热力图">${out}</svg>`;
  }

  /** 水平条：价值类型 / 平台分布 */
  function hbars(items, { color = 'var(--accent)' } = {}) {
    if (!items.length) return '';
    const max = Math.max(...items.map((d) => d.count), 1);
    return `<div class="legend">${items.map((d) => `
      <div><i style="background:${d.color || color}"></i><span>${esc(d.name || d.id)}</span>
        <span style="flex:1;height:6px;margin:0 8px;background:var(--rule);position:relative;min-width:40px">
          <span style="position:absolute;inset:0 auto 0 0;width:${((d.count / max) * 100).toFixed(1)}%;background:${d.color || color};opacity:.8"></span>
        </span>
        <span class="c">${d.count}</span></div>`).join('')}</div>`;
  }

  SM.charts = { bars, donut, heat, hbars, esc };
})();
