/* 路由、事件与入场编排 */
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => SM.charts.esc(s == null ? '' : s);
  const F = () => SM.filter.state;
  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches); // 无 matchMedia 的环境降级

  let route = { name: 'flow', id: '' };

  function parseHash() {
    const h = (location.hash || '#/flow').replace(/^#\/?/, '');
    const [name, id] = h.split('/');
    const valid = ['flow', 'topic', 'insight', 'item'];
    return { name: valid.includes(name) ? name : 'flow', id: id ? decodeURIComponent(id) : '' };
  }

  /* ---------- 工具栏 ---------- */
  function toolbarHTML() {
    const counts = {};
    SM.marks.forEach((m) => { counts[m.category] = (counts[m.category] || 0) + 1; });
    const cats = SM.tax.categories.filter((c) => counts[c.id]).map((c) =>
      `<button class="chip${F().cats.has(c.id) ? ' on' : ''}" data-f="cat" data-v="${c.id}">
        <span class="dot" style="background:${c.color}"></span>${esc(c.name)}<span class="n">${counts[c.id]}</span></button>`).join('');

    const vals = (SM.tax.valueTypes || []).filter((v) => SM.marks.some((m) => m.valueType === v.id)).map((v) =>
      `<button class="chip${F().value === v.id ? ' on' : ''}" data-f="value" data-v="${v.id}">${esc(v.name)}</button>`).join('');

    const sts = [['unread', '未读'], ['reading', '在读'], ['done', '已读']].map(([k, v]) =>
      `<button class="chip${F().status === k ? ' on' : ''}" data-f="status" data-v="${k}">${v}</button>`).join('');

    const sorts = [['time', '按时间'], ['rating', '按评分'], ['category', '按主题']].map(([k, v]) =>
      `<button class="chip${F().sort === k ? ' on' : ''}" data-f="sort" data-v="${k}">${v}</button>`).join('');

    return `<input class="search" id="q" type="search" placeholder="搜标题、摘要、要点、原文…" value="${esc(F().q)}">
      <div class="chips">${cats}</div>
      <div class="chips">${vals}
        <button class="chip${F().actionableOnly ? ' on' : ''}" data-f="actionable">▶ 可做</button>
        <button class="chip${F().starredOnly ? ' on' : ''}" data-f="starred">★ 星标</button>
        ${sts}${sorts}
        ${SM.filter.activeCount() ? '<button class="chip" data-f="reset">清除筛选 ✕</button>' : ''}
      </div>`;
  }

  /* ---------- 渲染 ---------- */
  function render() {
    route = parseHash();
    document.querySelectorAll('.nav a').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('href') === `#/${route.name}`);
    });
    $('#toolbar').style.display = route.name === 'item' ? 'none' : '';

    if (route.name === 'item') {
      const m = SM.byId.get(route.id);
      $('#view').innerHTML = m ? SM.views.detail(m)
        : '<div class="empty"><div class="big">没找到这条</div></div>';
    } else {
      $('#toolbar').innerHTML = toolbarHTML();
      const list = SM.filter.apply(SM.marks);
      $('#count').textContent = `${list.length} / ${SM.marks.length} 条`;
      $('#view').innerHTML = route.name === 'topic' ? SM.views.topic(list)
        : route.name === 'insight' ? SM.views.insight(list) : SM.views.flow(list);
    }
    reveal();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /** 入场编排：错峰淡入上浮，最多 8 组 */
  function reveal() {
    const items = [...document.querySelectorAll('#view .entry, #view .panel, #view .group, #view .detail')];
    const reduce = mq('(prefers-reduced-motion: reduce)');
    if (reduce) return;
    items.forEach((el, i) => {
      el.classList.add('reveal');
      const d = Math.min(i, 8) * 70;
      setTimeout(() => el.classList.add('in'), 20 + d);
    });
  }

  /* ---------- 事件 ---------- */
  function onToolbarClick(e) {
    const btn = e.target.closest('[data-f]');
    if (!btn) return;
    const f = btn.dataset.f;
    const v = btn.dataset.v;
    const s = F();
    if (f === 'cat') SM.filter.toggle(s.cats, v);
    else if (f === 'value') s.value = s.value === v ? '' : v;
    else if (f === 'status') s.status = s.status === v ? '' : v;
    else if (f === 'sort') s.sort = v;
    else if (f === 'actionable') s.actionableOnly = !s.actionableOnly;
    else if (f === 'starred') s.starredOnly = !s.starredOnly;
    else if (f === 'reset') SM.filter.reset();
    render();
  }

  function onViewClick(e) {
    const tagLink = e.target.closest('[data-tag]');
    if (tagLink) {
      e.preventDefault();
      SM.filter.state.tags.clear();
      SM.filter.state.tags.add(tagLink.dataset.tag);
      location.hash = '#/flow';
      render();
      return;
    }
    const m = SM.byId.get(route.id);
    const act = e.target.closest('[data-act]');
    if (!m || !act) return;
    const a = act.dataset.act;
    const v = act.dataset.v;
    if (a === 'star') SM.store.set(m.id, { starred: !SM.store.get(m.id).starred });
    else if (a === 'status') SM.store.set(m.id, { readStatus: v });
    else if (a === 'rate') SM.store.set(m.id, { rating: Number(v) });
    render();
  }

  /* ---------- 主题 ---------- */
  function initTheme() {
    const saved = localStorage.getItem('supermark.theme');
    const dark = saved ? saved === 'dark' : mq('(prefers-color-scheme: dark)');
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('#theme').textContent = dark ? '☀' : '☾';
    $('#theme').addEventListener('click', () => {
      const now = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = now;
      localStorage.setItem('supermark.theme', now);
      $('#theme').textContent = now === 'dark' ? '☀' : '☾';
    });
  }

  /* ---------- 启动 ---------- */
  async function boot() {
    SM.marks.forEach((m, i) => { m._no = SM.marks.length - i; }); // 收藏册编号，倒序固定
    await SM.store.init();
    initTheme();

    const s = SM.stats;
    $('#meta').innerHTML = [
      `收录 <b>${s.total}</b> 条`,
      `跨度 <b>${s.spanDays}</b> 天`,
      `可行动 <b>${s.actionable}</b> 条`,
      `更新 <b>${SM.fmtDate(s.builtAt)}</b>`,
    ].join('　·　');

    $('#toolbar').addEventListener('click', onToolbarClick);
    $('#view').addEventListener('click', onViewClick);
    $('#toolbar').addEventListener('input', (e) => {
      if (e.target.id !== 'q') return;
      F().q = e.target.value;
      clearTimeout(window.__t);
      window.__t = setTimeout(() => {
        const pos = e.target.selectionStart;
        render();
        const el = document.getElementById('q');
        if (el) { el.focus(); el.setSelectionRange(pos, pos); }
      }, 180);
    });

    window.addEventListener('hashchange', render);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
