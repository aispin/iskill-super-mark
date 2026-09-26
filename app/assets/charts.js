/* 手写图表：零依赖，全部走 CSS 变量以适配暗/亮主题
   柱状图用 HTML/CSS（月数少时不会被拉成巨柱），环图与热力图用 SVG */
window.SM = window.SM || {};
(function () {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** 竖柱状图（HTML/CSS 实现，避免月份少时被拉伸变胖） */
  function bars(items, { h = 168, label = '' } = {}) {
    if (!items.length) return '';
    const max = Math.max(...items.map((d) => d.count), 1);
    const cols = items.map((d) => {
      const p = Math.max(3, Math.round((d.count / max) * 100));
      const m = String(d.month || '');
      return `<div class="bcol" title="${esc(m)} · ${d.count} 条">
        <span class="bv">${d.count}</span>
        <span class="bbar" style="--p:${p}%"></span>
        <span class="bl">${esc(m.slice(0, 4))}<em>${esc(m.slice(5))}</em></span>
      </div>`;
    }).join('');
    return `<div class="bars" style="--h:${h}px" role="img" aria-label="${esc(label)}">${cols}</div>`;
  }

  /** 环形图：分类占比 */
  function donut(items, total, { size = 172 } = {}) {
    if (!items.length) return '';
    const cx = size / 2;
    const r = cx - 12;
    const C = 2 * Math.PI * r;
    let acc = 0;
    const segs = items.map((d) => {
      const len = (d.count / (total || 1)) * C;
      const s = `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${d.color}"
        stroke-width="17" stroke-dasharray="${(len - 1.5).toFixed(2)} ${(C - len + 1.5).toFixed(2)}"
        stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${cx} ${cx})"><title>${esc(d.name)} ${d.count} 条</title></circle>`;
      acc += len;
      return s;
    }).join('');
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="分类占比">
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--rule)" stroke-width="17"/>
      ${segs}
      <text x="${cx}" y="${cx + 4}" text-anchor="middle" font-size="34" font-family="var(--font-mono)"
        fill="var(--ink)" font-variant-numeric="tabular-nums">${total}</text>
      <text x="${cx}" y="${cx + 26}" text-anchor="middle" font-size="10" font-family="var(--font-mono)"
        fill="var(--muted)" letter-spacing="2">条收藏</text>
    </svg>`;
  }

  /** 热力矩阵：星期 × 小时 的收藏密度 */
  function heat(matrix, { cell = 15, gap = 3 } = {}) {
    const flat = matrix.flat();
    const max = Math.max(...flat, 1);
    const w = 24 * (cell + gap) + 28;
    const h = 7 * (cell + gap) + 20;
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    let out = '';
    for (let d = 0; d < 7; d++) {
      out += `<text x="0" y="${d * (cell + gap) + cell - 2}" font-size="10" font-family="var(--font-mono)" fill="var(--muted)">${days[d]}</text>`;
      for (let hr = 0; hr < 24; hr++) {
        const v = matrix[d][hr];
        const op = v ? 0.2 + 0.8 * (v / max) : 0.07;
        out += `<rect x="${28 + hr * (cell + gap)}" y="${d * (cell + gap)}" width="${cell}" height="${cell}"
          rx="2" fill="var(--accent)" opacity="${op.toFixed(2)}"><title>周${days[d]} ${hr}:00 · ${v} 条</title></rect>`;
      }
    }
    [0, 6, 12, 18, 23].forEach((hr) => {
      out += `<text x="${28 + hr * (cell + gap)}" y="${h - 5}" font-size="9" font-family="var(--font-mono)" fill="var(--muted)">${hr}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="收藏时间热力图">${out}</svg>`;
  }

  /** 水平条：分类 / 价值类型 / 平台分布 */
  function hbars(items, { color = 'var(--accent)' } = {}) {
    if (!items.length) return '';
    const max = Math.max(...items.map((d) => d.count), 1);
    return `<div class="legend">${items.map((d) => `
      <div><i style="background:${d.color || color}"></i>
        <span class="lb">${esc(d.name || d.id)}</span>
        <span class="tr"><span style="width:${((d.count / max) * 100).toFixed(1)}%;background:${d.color || color}"></span></span>
        <span class="c">${d.count}</span></div>`).join('')}</div>`;
  }

  SM.charts = { bars, donut, heat, hbars, esc };
})();
