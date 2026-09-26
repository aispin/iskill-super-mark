/* 视图渲染：流 / 分类 / 洞察 / 详情 —— 杂志编辑风 */
window.SM = window.SM || {};
(function () {
  const esc = (s) => SM.charts.esc(s == null ? '' : s);
  const C = (id) => SM.catColor(id);

  const STATUS_LABEL = { unread: '未读', reading: '在读', done: '已读', archived: '归档' };

  /** 单条目（杂志目录式一行） */
  function entryHTML(m) {
    const u = SM.store.get(m.id);
    const tags = (m.tags || []).slice(0, 3);
    const flags = [];
    if (m.actionable) flags.push('<span class="flag">▶ 可做</span>');
    if (u.readStatus === 'done') flags.push('<span class="flag dim">已读</span>');
    if (u.readStatus === 'reading') flags.push('<span class="flag dim">在读</span>');
    return `<a class="entry" href="#/item/${encodeURIComponent(m.id)}" style="--cat:${C(m.category)}">
      <span class="entry-no">No.${String(m._no).padStart(3, '0')}</span>
      <span class="entry-body">
        <span class="entry-title">${esc(m.title)}</span>
        <p class="entry-sum">${esc(m.summary || m.rawText || '')}</p>
        <span class="entry-tags">
          <span class="tag cat">${esc(m.categoryName)}</span>
          ${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
          ${flags.join('')}
        </span>
      </span>
      <span class="entry-side">
        <span class="date">${SM.fmtShort(m.sentAt)}</span>
        <span class="plat">${esc(SM.platLabel(m.sourcePlatform))}</span>
        <span class="marks">${u.starred ? '<span class="star-on">★</span>' : '<span class="flag dim">☆</span>'}${(u.rating || 0) ? `<span class="flag dim"> ${u.rating}★</span>` : ''}</span>
      </span>
    </a>`;
  }

  function listHTML(marks) {
    if (!marks.length) {
      return `<div class="empty"><div class="big">这一栏暂时是空的</div>
        <div>换个筛选条件，或者去微信里再收藏几条。</div></div>`;
    }
    return `<div class="list">${marks.map(entryHTML).join('')}</div>`;
  }

  /** 流：时间倒序 + 筛选结果 */
  function flow(marks) {
    return listHTML(marks);
  }

  /** 分类：按一级分类聚合 + 标签云 */
  function topic(marks) {
    if (!marks.length) return listHTML(marks);
    const groups = new Map();
    marks.forEach((m) => {
      if (!groups.has(m.category)) groups.set(m.category, []);
      groups.get(m.category).push(m);
    });
    const order = SM.tax.categories.map((c) => c.id);
    const ids = [...groups.keys()].sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    const tagCount = {};
    SM.marks.forEach((m) => {
      for (const t of [...(m.tags || []), ...(m.rawTags || [])]) tagCount[t] = (tagCount[t] || 0) + 1;
    });
    const top = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 30);
    const maxT = top.length ? top[0][1] : 1;
    const cloud = `<div class="cloud">${top.map(([t, n]) =>
      `<a href="#/flow" data-tag="${esc(t)}" style="font-size:${12 + Math.round((n / maxT) * 12)}px"><b>${esc(t)}</b> <span style="color:var(--muted);font-family:var(--font-mono);font-size:10px">${n}</span></a>`).join('')}</div>`;

    const blocks = ids.map((cid) => {
      const items = groups.get(cid).sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
      const subs = {};
      items.forEach((m) => { if (m.subCategory) subs[m.subCategory] = (subs[m.subCategory] || 0) + 1; });
      const subLine = Object.entries(subs).sort((a, b) => b[1] - a[1]).slice(0, 4)
        .map(([s, n]) => `${esc(s)} ${n}`).join(' · ');
      return `<section class="group">
        <div class="group-head">
          <h2 style="color:${C(cid)}">${esc(SM.catName(cid))}</h2>
          <span class="n">${items.length} 条${subLine ? ' · ' + subLine : ''}</span>
          <span class="bar"></span>
        </div>
        <div class="list">${items.map(entryHTML).join('')}</div>
      </section>`;
    }).join('');

    return `<section class="panel" style="margin-bottom:var(--s-5)">
        <h3>标签云</h3><div class="sub">点标签直接筛选 · 共 ${Object.keys(tagCount).length} 个标签</div>${cloud}
      </section>${blocks}`;
  }

  /** 洞察：统计与图表 */
  function insight(marks) {
    const s = SM.stats;
    const shown = {};
    marks.forEach((m) => { shown[m.category] = (shown[m.category] || 0) + 1; });
    const catList = SM.tax.categories
      .map((c) => ({ id: c.id, name: c.name, color: c.color, count: shown[c.id] || 0 }))
      .filter((c) => c.count > 0).sort((a, b) => b.count - a.count);

    const todo = SM.marks.filter((m) => m.actionable && SM.store.get(m.id).readStatus !== 'done').slice(0, 8);

    return `<div class="stat-row">
        <div class="stat"><div class="v">${s.total}</div><div class="k">条收藏</div></div>
        <div class="stat"><div class="v">${s.spanDays}</div><div class="k">天跨度</div></div>
        <div class="stat"><div class="v">${s.actionable}</div><div class="k">可行动</div></div>
        <div class="stat"><div class="v">${(s.byCategory || []).length}</div><div class="k">个主题</div></div>
        <div class="stat"><div class="v">${s.pending}</div><div class="k">待分析</div></div>
      </div>
      <div class="insight-grid">
        <section class="panel">
          <h3>收藏节奏</h3><div class="sub">${SM.fmtDate(s.firstAt)} — ${SM.fmtDate(s.lastAt)}</div>
          ${SM.charts.bars(s.byMonth || [], { h: 150, label: '按月收藏量' })}
        </section>
        <section class="panel">
          <h3>注意力分布</h3><div class="sub">一级分类占比</div>
          <div style="display:flex;gap:var(--s-3);align-items:center;flex-wrap:wrap">
            ${SM.charts.donut(catList, marks.length)}
            <div style="flex:1;min-width:160px">${SM.charts.hbars(catList)}</div>
          </div>
        </section>
        <section class="panel">
          <h3>什么时候在收藏</h3><div class="sub">星期 × 小时的收藏密度</div>
          ${SM.charts.heat(s.heat || Array.from({ length: 7 }, () => new Array(24).fill(0)))}
        </section>
        <section class="panel">
          <h3>收藏的价值类型</h3><div class="sub">你存下来的多半是哪一类</div>
          ${SM.charts.hbars((s.byValueType || []).map((v) => ({ ...v, color: C('ai') })))}
        </section>
        <section class="panel">
          <h3>来源构成</h3><div class="sub">内容主要从哪来</div>
          ${SM.charts.hbars((s.byPlatform || []).map((p) => ({ ...p, name: SM.platLabel(p.id), color: C('media') })))}
        </section>
        <section class="panel">
          <h3>看了还没做</h3><div class="sub">标记了「可做」但还没读完</div>
          ${todo.length ? `<div class="list">${todo.map(entryHTML).join('')}</div>`
            : '<div class="empty"><div class="big">全部消化完了</div></div>'}
        </section>
      </div>`;
  }

  /** 详情 */
  function detail(m) {
    const u = SM.store.get(m.id);
    const points = (m.keyPoints || []).length
      ? `<ul class="points">${m.keyPoints.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
    const tags = [...(m.tags || []), ...(m.rawTags || [])];
    const statusBtns = Object.entries(STATUS_LABEL).map(([k, v]) =>
      `<button class="chip${u.readStatus === k ? ' on' : ''}" data-act="status" data-v="${k}">${v}</button>`).join('');
    const stars = [1, 2, 3, 4, 5].map((n) =>
      `<button class="chip" data-act="rate" data-v="${n}" style="${(u.rating || 0) >= n ? 'background:var(--accent);color:var(--paper);border-color:var(--accent)' : ''}">${n}</button>`).join('');

    return `<article class="detail">
      <a class="back" href="#/flow">← 返回收藏册</a>
      <h1>${esc(m.title)}</h1>
      <div class="meta">
        <span>${SM.fmtDate(m.sentAt)} ${SM.fmtTime(m.sentAt)}</span>
        <span>${esc(SM.platLabel(m.sourcePlatform))}</span>
        <span style="color:${C(m.category)}">${esc(m.categoryName)}${m.subCategory ? ' · ' + esc(m.subCategory) : ''}</span>
        ${m.valueType ? `<span>${esc(SM.valName(m.valueType))}</span>` : ''}
        ${(m.audience || []).length ? `<span>给 ${m.audience.map((a) => esc(SM.audName(a))).join('/')}</span>` : ''}
        <span>No.${String(m._no).padStart(3, '0')}</span>
      </div>
      <blockquote class="quote">${esc(m.summary)}</blockquote>
      ${points}
      ${m.actionHint ? `<p style="font-family:var(--font-mono);font-size:var(--t-sm);color:var(--accent)">▶ ${esc(m.actionHint)}</p>` : ''}
      ${m.rawText ? `<div class="raw">${esc(m.rawText)}</div>` : ''}
      ${tags.length ? `<div class="entry-tags" style="margin-bottom:var(--s-4)">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="actions">
        ${m.url ? `<a class="open-link" href="${esc(m.url)}" target="_blank" rel="noopener">打开原内容 ↗</a>` : ''}
        <button class="chip${u.starred ? ' on' : ''}" data-act="star">${u.starred ? '★ 已收藏' : '☆ 加星'}</button>
        ${statusBtns}
        <span style="font-family:var(--font-mono);font-size:var(--t-xs);color:var(--muted)">评分</span>
        ${stars}
        <textarea class="note" placeholder="写下你的想法、决定、或者这条为什么值得留着…">${esc(u.note || '')}</textarea>
      </div>
    </article>`;
  }

  SM.views = { flow, topic, insight, detail, entryHTML };
})();
