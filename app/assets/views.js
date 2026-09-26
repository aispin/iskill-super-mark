/* 视图渲染：Hero / 精选 / 海报网格 / 列表 / 主题 / 洞察 / 详情
   版式语言照搬 Netflix Media Center：全幅渐变 Hero → 精选海报行 →
   带强调色栏目标题 → 描边胶囊筛选 → 4 列 2:3 竖版海报网格。
   配色换成自己的：暖近黑底 + 朱砂强调 + 分类色海报。 */
window.SM = window.SM || {};
(function () {
  const esc = (s) => SM.charts.esc(s == null ? '' : s);
  const C = (id) => SM.catColor(id);
  const V = (id) => SM.catVars(id);
  const no = (m) => String(m._no).padStart(3, '0');

  const STATUS_LABEL = { unread: '未读', reading: '在读', done: '已读', archived: '归档' };

  /** 标题字号：按字数分档，让长短标题都能撑满海报留白 */
  function titleSize(t) {
    const n = [...String(t || '')].length;
    if (n <= 6) return 30;
    if (n <= 10) return 25;
    if (n <= 16) return 21;
    if (n <= 26) return 17;
    return 15;
  }

  /** 海报卡：2:3 竖版，分类色渐变 + 几何母题 + 标题排版（没有图，就把排版当图） */
  function posterHTML(m) {
    const u = SM.store.get(m.id);
    return `<a class="card" href="#/item/${encodeURIComponent(m.id)}"
        style="${SM.posterVars(m.id, m.category)}" title="${esc(m.title)}">
      <span class="poster" data-p="${SM.posterGlyph(m.id)}">
        <span class="poster-top">
          <span class="pt-l">
            <span class="poster-plat">${esc(SM.platLabel(m.sourcePlatform))}</span>
            ${m.actionable ? '<span class="poster-badge">可做</span>' : ''}
          </span>
          <span class="poster-no">${no(m)}</span>
        </span>
        <span class="poster-title" style="--tf:${titleSize(m.title)}px">${esc(m.title)}</span>
        ${u.starred ? '<span class="poster-star" aria-label="已加星">★</span>' : ''}
      </span>
      <span class="card-cap">
        <span class="cap-cat" style="color:${C(m.category)}">${esc(m.categoryName)}</span>
        <span class="cap-sep">·</span>
        <span>${SM.fmtShort(m.sentAt)}</span>
      </span>
    </a>`;
  }

  /** 网格：4 列（桌面）/ 2 列（移动） */
  function gridHTML(marks) {
    if (!marks.length) return emptyHTML();
    return `<div class="grid">${marks.map(posterHTML).join('')}</div>`;
  }

  /** 列表模式：需要快速扫读时的紧凑行 */
  function entryHTML(m) {
    const u = SM.store.get(m.id);
    const tags = (m.tags || []).slice(0, 3);
    return `<a class="row" href="#/item/${encodeURIComponent(m.id)}" style="${V(m.category)}">
      <span class="row-no">${no(m)}</span>
      <span class="row-main">
        <span class="row-title">${esc(m.title)}</span>
        <span class="row-sum">${esc(m.summary || m.rawText || '')}</span>
        <span class="row-tags">
          <span class="tag cat">${esc(m.categoryName)}</span>
          ${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
          ${m.actionable ? '<span class="flag">▶ 可做</span>' : ''}
          ${u.starred ? '<span class="star-on">★</span>' : ''}
        </span>
      </span>
      <span class="row-side">${SM.fmtShort(m.sentAt)}<em>${esc(SM.platLabel(m.sourcePlatform))}</em></span>
    </a>`;
  }

  function listHTML(marks) {
    if (!marks.length) return emptyHTML();
    return `<div class="rows">${marks.map(entryHTML).join('')}</div>`;
  }

  function emptyHTML() {
    return `<div class="empty"><div class="big">这一栏暂时是空的</div>
      <div>换个筛选条件，或者在微信里再收藏几条。</div></div>`;
  }

  function marksHTML(marks) {
    return SM.viewMode === 'list' ? listHTML(marks) : gridHTML(marks);
  }

  /* ---------- Hero ---------- */
  /**
   * 精选行：最新 4 条做成海报，贴在 Hero 渐变的下缘（Netflix 的做法）。
   * 有筛选条件时只留标题，不再showing 精选，避免误导。
   */
  function featuredHTML(marks) {
    const list = marks.slice(0, 4);
    if (!list.length) return '';
    // 注意：容器 #featured 自身已带 .featured 类，这里只返回卡片，别再套一层网格
    return list.map(posterHTML).join('');
  }

  function secTitle(routeName, marks) {
    const s = SM.stats;
    if (routeName === 'topic') return `我收藏的主题<span class="accent"> · ${(s.byCategory || []).length} 类</span>`;
    if (routeName === 'insight') return `注意力洞察<span class="accent"> · ${marks.length} 条</span>`;
    return `近 ${s.spanDays} 天的收藏<span class="accent"> · ${marks.length} 条</span>`;
  }

  /* ---------- 流 ---------- */
  function flow(marks) {
    if (!marks.length) return emptyHTML();
    return marksHTML(marks);
  }

  /* ---------- 主题 ---------- */
  function topic(marks) {
    if (!marks.length) return emptyHTML();
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
    const top = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 28);
    const cloud = `<div class="cloud">${top.map(([t, n]) =>
      `<a href="#/flow" data-tag="${esc(t)}">${esc(t)}<span>${n}</span></a>`).join('')}</div>`;

    const blocks = ids.map((cid) => {
      const items = groups.get(cid).sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
      const subs = {};
      items.forEach((m) => { if (m.subCategory) subs[m.subCategory] = (subs[m.subCategory] || 0) + 1; });
      const subLine = Object.entries(subs).sort((a, b) => b[1] - a[1]).slice(0, 4)
        .map(([s, n]) => `${esc(s)} ${n}`).join(' / ');
      return `<section class="grp">
        <div class="grp-head">
          <h3 style="color:${C(cid)}">${esc(SM.catName(cid))}</h3>
          <span class="grp-n">${items.length} 条${subLine ? ' · ' + subLine : ''}</span>
        </div>
        ${SM.viewMode === 'list' ? listHTML(items) : gridHTML(items)}
      </section>`;
    }).join('');

    return `<section class="grp">
        <div class="grp-head"><h3>标签云</h3><span class="grp-n">${Object.keys(tagCount).length} 个标签 · 点选筛选</span></div>
        ${cloud}
      </section>${blocks}`;
  }

  /* ---------- 洞察 ---------- */
  function insight(marks) {
    const s = SM.stats;
    const shown = {};
    marks.forEach((m) => { shown[m.category] = (shown[m.category] || 0) + 1; });
    const catList = SM.tax.categories
      .map((c) => ({ id: c.id, name: c.name, color: C(c.id), count: shown[c.id] || 0 }))
      .filter((c) => c.count > 0).sort((a, b) => b.count - a.count);

    const todo = SM.marks.filter((m) => m.actionable && SM.store.get(m.id).readStatus !== 'done').slice(0, 8);

    return `<div class="stats">
        <div class="stat"><div class="v">${s.total}</div><div class="k">条收藏</div></div>
        <div class="stat"><div class="v">${s.spanDays}</div><div class="k">天跨度</div></div>
        <div class="stat"><div class="v">${s.actionable}</div><div class="k">可行动</div></div>
        <div class="stat"><div class="v">${(s.byCategory || []).length}</div><div class="k">个主题</div></div>
        <div class="stat"><div class="v">${(s.byPlatform || []).length}</div><div class="k">个来源</div></div>
      </div>
      <div class="panels">
        <section class="panel">
          <div class="grp-head"><h3>收藏节奏</h3><span class="grp-n">${SM.fmtDate(s.firstAt)} — ${SM.fmtDate(s.lastAt)}</span></div>
          ${SM.charts.bars(s.byMonth || [], { h: 190, label: '按月收藏量' })}
        </section>
        <section class="panel">
          <div class="grp-head"><h3>注意力分布</h3><span class="grp-n">一级分类占比</span></div>
          <div class="donut-row">${SM.charts.donut(catList, marks.length)}${SM.charts.hbars(catList)}</div>
        </section>
        <section class="panel">
          <div class="grp-head"><h3>什么时候在收藏</h3><span class="grp-n">星期 × 小时</span></div>
          ${SM.charts.heat(s.heat || Array.from({ length: 7 }, () => new Array(24).fill(0)))}
        </section>
        <section class="panel">
          <div class="grp-head"><h3>价值类型</h3><span class="grp-n">你存下来的多半是哪一类</span></div>
          ${SM.charts.hbars((s.byValueType || []).map((v) => ({ ...v, color: C('ai') })))}
        </section>
        <section class="panel">
          <div class="grp-head"><h3>来源构成</h3><span class="grp-n">内容主要从哪来</span></div>
          ${SM.charts.hbars((s.byPlatform || []).map((p) => ({ ...p, name: SM.platLabel(p.id), color: C('media') })))}
        </section>
        <section class="panel">
          <div class="grp-head"><h3>看了还没做</h3><span class="grp-n">标记了「可做」但还没读完</span></div>
          ${todo.length ? gridHTML(todo) : '<div class="empty"><div class="big">全部消化完了</div></div>'}
        </section>
      </div>`;
  }

  /* ---------- 详情 ---------- */
  function detail(m) {
    const u = SM.store.get(m.id);
    const points = (m.keyPoints || []).length
      ? `<ul class="points">${m.keyPoints.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
    const tags = [...(m.tags || []), ...(m.rawTags || [])];
    const statusBtns = Object.entries(STATUS_LABEL).map(([k, v]) =>
      `<button class="pill${u.readStatus === k ? ' on' : ''}" data-act="status" data-v="${k}">${v}</button>`).join('');
    const stars = [1, 2, 3, 4, 5].map((n) =>
      `<button class="pill${(u.rating || 0) >= n ? ' on' : ''}" data-act="rate" data-v="${n}">${n}</button>`).join('');

    // 深度解读：转写稿产出的结构化段落（有则显示）
    const deep = m.deep || null;
    const deepHTML = deep ? `
      ${deep.thesis ? `<div class="deep"><h4>核心论点</h4><p>${esc(deep.thesis)}</p></div>` : ''}
      ${(deep.steps || []).length ? `<div class="deep"><h4>方法与步骤</h4><ol>${deep.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}
      ${(deep.facts || []).length ? `<div class="deep"><h4>关键信息</h4><ul class="facts">${deep.facts.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
      ${deep.takeaway ? `<div class="deep"><h4>可落地的结论</h4><p>${esc(deep.takeaway)}</p></div>` : ''}
      ${(deep.caveats || []).length ? `<div class="deep"><h4>局限与保留</h4><ul class="facts dim">${deep.caveats.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
      ${(deep.related || []).length ? `<div class="deep"><h4>与已有收藏的关联</h4><ul class="facts">${deep.related.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}` : '';

    const tr = m.transcript || null;
    const trHTML = tr ? `<section class="sec">
        <div class="grp-head"><h4>音频转写</h4><span class="grp-n">${esc(tr.engine || '本地')}${tr.durationSec ? ' · ' + Math.round(tr.durationSec / 60) + ' 分钟' : ''}${tr.audioPath ? ' · 已归档 mp3' : ''}</span></div>
        <details class="transcript"><summary>展开全文（${[...String(tr.text || '')].length} 字）</summary>
          <div class="raw">${esc(tr.text || '')}</div></details>
      </section>` : '';

    return `<article class="detail" style="${V(m.category)}">
      <a class="back" href="#/flow">← 返回收藏册</a>
      <div class="dhead">
        <span class="dno">NO.${no(m)}</span>
        <h1>${esc(m.title)}</h1>
        <div class="dmeta">
          <span>${SM.fmtDate(m.sentAt)} ${SM.fmtTime(m.sentAt)}</span>
          <span class="cat">${esc(m.categoryName)}${m.subCategory ? ' · ' + esc(m.subCategory) : ''}</span>
          <span>${esc(SM.platLabel(m.sourcePlatform))}</span>
          ${m.valueType ? `<span>${esc(SM.valName(m.valueType))}</span>` : ''}
          ${(m.audience || []).length ? `<span>给 ${m.audience.map((a) => esc(SM.audName(a))).join('/')}</span>` : ''}
          ${m.transcript ? '<span class="flag">已转写</span>' : ''}
          ${m.deep ? '<span class="flag">已深读</span>' : ''}
        </div>
      </div>
      <blockquote class="quote">${esc(m.summary)}</blockquote>
      ${points}
      ${m.actionHint ? `<p class="hint"><b>ACTION</b><span>${esc(m.actionHint)}</span></p>` : ''}
      ${deepHTML}
      ${m.rawText ? `<section class="sec"><div class="grp-head"><h4>转发原文</h4></div><div class="raw">${esc(m.rawText)}</div></section>` : ''}
      ${trHTML}
      ${tags.length ? `<div class="row-tags" style="margin:var(--s-4) 0">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="actions">
        ${m.url ? `<a class="cta" href="${esc(m.url)}" target="_blank" rel="noopener">打开原内容 ↗</a>` : ''}
        <button class="pill${u.starred ? ' on' : ''}" data-act="star">${u.starred ? '★ 已收藏' : '☆ 加星'}</button>
        ${statusBtns}
        <span class="lbl">评分</span>${stars}
        <textarea class="note" placeholder="写下你的想法、决定、或者这条为什么值得留着…">${esc(u.note || '')}</textarea>
      </div>
    </article>`;
  }

  SM.views = { flow, topic, insight, detail, featuredHTML, secTitle, marksHTML };
})();
