/* 路由、事件与入场编排 */
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => SM.charts.esc(s == null ? '' : s);
  const F = () => SM.filter.state;
  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);

  let route = { name: 'flow', id: '' };
  SM.viewMode = 'poster';

  function parseHash() {
    const h = (location.hash || '#/flow').replace(/^#\/?/, '');
    const [name, id] = h.split('/');
    const valid = ['flow', 'topic', 'insight', 'item'];
    return { name: valid.includes(name) ? name : 'flow', id: id ? decodeURIComponent(id) : '' };
  }

  /* ---------- 顶栏 / Hero ---------- */
  function buildChrome() {
    const s = SM.stats;
    $('#ctaN').textContent = s.actionable;
    $('#heroSub').textContent =
      `微信视频号里的随手收藏，按主题归好、按内容读懂，随时回来翻。`;
    $('#footMeta').innerHTML =
      `收录 <b>${s.total}</b> 条 · 跨度 ${s.spanDays} 天 · 更新 ${SM.fmtDate(s.builtAt)}`;
  }

  function sortByTime(list) {
    return [...list].sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
  }

  function renderFeatured() {
    const box = $('#featured');
    const show = route.name === 'flow' && !SM.filter.activeCount();
    box.innerHTML = show ? SM.views.featuredHTML(sortByTime(SM.marks).slice(0, 4)) : '';
  }

  /* ---------- 筛选胶囊 ---------- */
  function pillsHTML() {
    const counts = {};
    SM.marks.forEach((m) => { counts[m.category] = (counts[m.category] || 0) + 1; });
    const cats = SM.tax.categories.filter((c) => counts[c.id]).map((c) =>
      `<button class="pill${F().cats.has(c.id) ? ' on' : ''}" data-f="cat" data-v="${c.id}">
        <span class="dot" style="background:${SM.catColor(c.id)}"></span>${esc(c.name)}<span class="n">${counts[c.id]}</span></button>`).join('');

    const switchHTML = `<span class="spacer"></span>
      <span class="viewswitch" role="group" aria-label="视图切换">
        <button data-f="mode" data-v="poster" class="${SM.viewMode === 'poster' ? 'on' : ''}">海报</button>
        <button data-f="mode" data-v="list" class="${SM.viewMode === 'list' ? 'on' : ''}">列表</button>
      </span>`;

    $('#pills').innerHTML = cats + switchHTML;

    const vals = (SM.tax.valueTypes || []).filter((v) => SM.marks.some((m) => m.valueType === v.id)).map((v) =>
      `<button class="pill${F().value === v.id ? ' on' : ''}" data-f="value" data-v="${v.id}">${esc(v.name)}</button>`).join('');
    const sts = [['unread', '未读'], ['reading', '在读'], ['done', '已读']].map(([k, v]) =>
      `<button class="pill${F().status === k ? ' on' : ''}" data-f="status" data-v="${k}">${v}</button>`).join('');
    const sorts = [['time', '最新'], ['rating', '评分'], ['category', '主题']].map(([k, v]) =>
      `<button class="pill${F().sort === k ? ' on' : ''}" data-f="sort" data-v="${k}">${v}</button>`).join('');

    $('#pills2').innerHTML = `${SM.filter.activeCount() ? '<button class="pill ghost" data-f="reset">清除 ✕</button><span class="sep"></span>' : ''}${vals}<span class="sep"></span>
      <button class="pill${F().actionableOnly ? ' on' : ''}" data-f="actionable">▶ 可做</button>
      <button class="pill${F().starredOnly ? ' on' : ''}" data-f="starred">★ 星标</button>
      <span class="sep"></span>${sts}<span class="sep"></span>${sorts}`;
  }

  /* ---------- 渲染 ---------- */
  function render(animate) {
    route = parseHash();
    document.querySelectorAll('.topnav a').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('href') === `#/${route.name}`);
    });

    const isItem = route.name === 'item';
    $('#hero').style.display = isItem ? 'none' : '';
    $('#pills').style.display = isItem ? 'none' : '';
    $('#pills2').style.display = isItem ? 'none' : '';
    document.querySelector('.sec-head').style.display = isItem ? 'none' : '';

    if (isItem) {
      const m = SM.byId.get(route.id);
      $('#view').innerHTML = m ? SM.views.detail(m)
        : '<div class="empty"><div class="big">没找到这条</div></div>';
      if (animate) reveal();
      scrollTop();
      return;
    }

    renderFeatured();
    pillsHTML();

    const list = SM.filter.apply(SM.marks);
    $('#secTitle').innerHTML = SM.views.secTitle(route.name, list);
    $('#secCount').textContent = `${list.length} / ${SM.marks.length}`;
    $('#view').innerHTML = route.name === 'topic' ? SM.views.topic(list)
      : route.name === 'insight' ? SM.views.insight(list) : SM.views.flow(list);

    // 筛选态下收起 Hero 大字，把首屏空间让给内容
    const compact = !(route.name === 'flow' && !SM.filter.activeCount());
    $('#hero').classList.toggle('compact', compact);

    if (animate) reveal();
    scrollTop();
  }

  function scrollTop() {
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch { window.scrollTo(0, 0); }
  }

  /** 入场编排：前 12 个元素错峰淡入；切筛选时不重放，避免拖慢操作 */
  function reveal() {
    if (mq('(prefers-reduced-motion: reduce)')) return;
    const items = [...document.querySelectorAll('#view .card, #view .row, #view .panel, #view .grp, #view .detail, #featured .card')];
    items.forEach((el, i) => {
      el.style.setProperty('--i', String(Math.min(i, 12)));
      el.classList.add('reveal');
    });
  }

  /* ---------- 事件 ---------- */
  function onFilterClick(e) {
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
    else if (f === 'mode') SM.viewMode = v;
    else if (f === 'reset') SM.filter.reset();
    render(false);
  }

  function onViewClick(e) {
    const tagLink = e.target.closest('[data-tag]');
    if (tagLink) {
      e.preventDefault();
      SM.filter.state.tags.clear();
      SM.filter.state.tags.add(tagLink.dataset.tag);
      location.hash = '#/flow';
      render(true);
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
    render(false);
  }

  /* ---------- 主题：暗色为基调 ---------- */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $('#theme').textContent = t === 'dark' ? '☀' : '☾';
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = t === 'dark' ? '#0b0a08' : '#ffffff';
  }

  function initTheme() {
    const saved = localStorage.getItem('supermark.theme');
    applyTheme(saved || 'dark');
    $('#theme').addEventListener('click', () => {
      const now = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(now);
      localStorage.setItem('supermark.theme', now);
      render(false); // 分类色与海报色随主题重新配平，需重绘
    });
  }

  /* ---------- 启动 ---------- */
  async function boot() {
    SM.marks.forEach((m, i) => { m._no = SM.marks.length - i; });
    await SM.store.init();
    initTheme();
    buildChrome();

    $('#pills').addEventListener('click', onFilterClick);
    $('#pills2').addEventListener('click', onFilterClick);
    $('#view').addEventListener('click', onViewClick);

    // 顶栏 CTA：一键跳到「可做」
    $('#cta').addEventListener('click', () => {
      F().actionableOnly = true;
      location.hash = '#/flow';
      render(false);
    });

    // 搜索框常驻 Hero，不随 render 重建，光标不会丢
    let t;
    $('#q').addEventListener('input', (e) => {
      F().q = e.target.value;
      clearTimeout(t);
      t = setTimeout(() => render(false), 160);
    });

    window.addEventListener('hashchange', () => render(true));
    render(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
