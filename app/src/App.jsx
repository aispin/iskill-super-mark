import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { marks, tax, stats, catColor } from '@/lib/data';
import { makeFilterState, applyFilter, activeFilterCount, featuredPicks } from '@/lib/filter';
import { storeInit, storeGet, useUserVersion } from '@/lib/store';
import { usePwa } from '@/lib/pwa.jsx';
import { useT, setLang, getLang } from '@/lib/i18n';
import { PosterCard, PosterGrid, ListView, EmptyState } from '@/components/Poster.jsx';
import { TopicView } from '@/components/TopicView.jsx';
import { InsightView } from '@/components/InsightView.jsx';
import { DetailView } from '@/components/DetailView.jsx';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
const SYS_DARK = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

function parseHash() {
  const h = (window.location.hash || '#/flow').replace(/^#\/?/, '');
  const [name, id] = h.split('/');
  const valid = ['flow', 'topic', 'insight', 'item'];
  return { name: valid.includes(name) ? name : 'flow', id: id ? decodeURIComponent(id) : '' };
}

/* ---------- 筛选胶囊 ---------- */
function Pill({ on, onClick, children, ghost = false }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        on ? 'border-[var(--color-accent)] bg-[var(--color-accent)] font-bold text-[var(--color-accent-ink)]'
          : ghost ? 'border-transparent text-[var(--color-muted)] hover:text-ink'
            : 'border-[var(--color-rule)] hover:border-[var(--color-accent)]'}`}>
      {children}
    </button>
  );
}

function Dot({ color }) {
  return <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />;
}

function FilterPills({ route, f, setF, viewMode, setViewMode, theme, counts }) {
  const t = useT();
  const act = activeFilterCount(f);
  const cats = tax.categories.filter((c) => counts[c.id]);
  const toggleCat = (id) => {
    const next = new Set(f.cats);
    if (next.has(id)) next.delete(id); else next.add(id);
    setF({ ...f, cats: next });
  };
  return (
    <>
      {/* 分类行 */}
      <div className="flex flex-wrap items-center gap-2">
        {cats.map((c) => (
          <Pill key={c.id} on={f.cats.has(c.id)} onClick={() => toggleCat(c.id)}>
            <Dot color={catColor(c.id, theme)} />{c.name}<span className="ml-1 font-mono text-xs opacity-70">{counts[c.id]}</span>
          </Pill>
        ))}
      </div>
      {/* 状态行：清除 / 价值类型 / 标注 */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {act > 0 && <Pill ghost onClick={() => setF({ ...makeFilterState(), q: f.q })}>{t('clear')}</Pill>}
        {act > 0 && <Sep />}
        {(tax.valueTypes || []).filter((v) => counts.values[v.id]).map((v) => (
          <Pill key={v.id} on={f.value === v.id} onClick={() => setF({ ...f, value: f.value === v.id ? '' : v.id })}>{v.name}</Pill>
        ))}
        {act > 0 && <Sep />}
        <Pill on={f.actionableOnly} onClick={() => setF({ ...f, actionableOnly: !f.actionableOnly })}>▶ {t('actionable')}</Pill>
        <Pill on={f.starredOnly} onClick={() => setF({ ...f, starredOnly: !f.starredOnly })}>★ {t('starred')}</Pill>
        <Sep />
        {[['unread', t('unread')], ['reading', t('reading')], ['done', t('done')]].map(([k, v]) => (
          <Pill key={k} on={f.status === k} onClick={() => setF({ ...f, status: f.status === k ? '' : k })}>{v}</Pill>
        ))}
      </div>
      {/* 排序（左）与显示模式（右）：单独一行，手机端不再挤在一起 */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[['time', t('sort_time')], ['rating', t('sort_rating')], ['category', t('sort_category')]].map(([k, v]) => (
            <Pill key={k} on={f.sort === k} onClick={() => setF({ ...f, sort: k })}>{v}</Pill>
          ))}
        </div>
        <span className="flex shrink-0 overflow-hidden rounded-full border border-[var(--color-rule)]" role="group" aria-label={t('view_poster') + ' / ' + t('view_list')}>
          {[['poster', t('view_poster')], ['list', t('view_list')]].map(([v, label]) => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`px-3 py-1 text-sm ${viewMode === v ? 'bg-[var(--color-accent)] font-bold text-[var(--color-accent-ink)]' : 'text-[var(--color-muted)]'}`}>{label}</button>
          ))}
        </span>
      </div>
    </>
  );
}
const Sep = () => <span className="h-4 w-px bg-[var(--color-rule)]" />;

/* ---------- 底部更新提示 ---------- */
function UpdateToast({ pwa }) {
  const t = useT();
  return (
    <AnimatePresence>
      {pwa.show && (
        <motion.div
          id="pwa-toast" role="status"
          className="fixed bottom-[18px] left-1/2 z-50 flex max-w-[min(92vw,460px)] -translate-x-1/2 items-center gap-3 rounded-lg border border-white/10 bg-stone-900 px-3.5 py-2.5 text-[13px] text-stone-50 shadow-2xl"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
        >
          <span className="flex-1">{t(pwa.textKey)}</span>
          <button onClick={pwa.onRefresh} className="rounded bg-[var(--color-accent)] px-2.5 py-1 font-bold text-[var(--color-accent-ink)]">{t('btn_refresh')}</button>
          <button onClick={pwa.onDismiss} aria-label="✕" className="px-1 opacity-60 hover:opacity-100">✕</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- 页脚构建信息 ---------- */
function FooterCredit() {
  const t = useT();
  const lang = getLang();
  const A = ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener" className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--color-accent)]">{children}</a>
  );
  return (
    <span>
      {lang === 'zh'
        ? <>Super Mark 使用 <A href="https://github.com/aispin/iskill-super-mark">iskill-super-mark</A> 超级技能基于 <A href="https://www.workbuddy.cn">WorkBuddy</A> 由 <A href="https://github.com/aispin">ZEO</A> 构建 · 版本号 v{APP_VERSION}</>
        : <>Super Mark — an <A href="https://github.com/aispin/iskill-super-mark">iskill-super-mark</A> skill built by <A href="https://github.com/aispin">ZEO</A> on <A href="https://www.workbuddy.cn">WorkBuddy</A> · v{APP_VERSION}</>}
    </span>
  );
}

/* ---------- App ---------- */
export default function App() {
  const t = useT();
  const [route, setRoute] = useState(parseHash);
  const [f, setF] = useState(makeFilterState);
  const [viewMode, setViewMode] = useState('poster');
  // 主题三态：system（跟随系统，默认）/ light / dark
  const [themePref, setThemePref] = useState(() => {
    try {
      const s = localStorage.getItem('supermark.theme');
      if (s === 'light' || s === 'dark') return s;
    } catch { /* 忽略 */ }
    return 'system';
  });
  const [sysDark, setSysDark] = useState(() => (SYS_DARK ? SYS_DARK.matches : true));
  const [ready, setReady] = useState(false);
  const userV = useUserVersion(); // 用户标注（星标/已读/评分）变化时联动筛选结果
  const pwa = usePwa();

  useEffect(() => { storeInit().then(() => setReady(true)); }, []);
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // 跟随系统：监听系统明暗变化
  useEffect(() => {
    if (!SYS_DARK) return undefined;
    const fn = (e) => setSysDark(e.matches);
    SYS_DARK.addEventListener('change', fn);
    return () => SYS_DARK.removeEventListener('change', fn);
  }, []);

  const theme = themePref === 'system' ? (sysDark ? 'dark' : 'light') : themePref;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = theme === 'dark' ? '#0c0a09' : '#f5f5f4';
  }, [theme]);

  // 明暗按钮三态循环：跟随系统 → 亮 → 暗
  const cycleTheme = () => {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(themePref) + 1) % 3];
    setThemePref(next);
    try {
      if (next === 'system') localStorage.removeItem('supermark.theme');
      else localStorage.setItem('supermark.theme', next);
    } catch { /* 忽略 */ }
  };
  const themeIcon = themePref === 'system' ? '◐' : themePref === 'light' ? '☀' : '☾';

  const counts = useMemo(() => {
    const c = { values: {} };
    marks.forEach((m) => { c[m.category] = (c[m.category] || 0) + 1; if (m.valueType) c.values[m.valueType] = (c.values[m.valueType] || 0) + 1; });
    return c;
  }, []);

  const isItem = route.name === 'item';
  const act = activeFilterCount(f);
  const showHero = !isItem;
  const compact = !(route.name === 'flow' && !act);
  const list = useMemo(() => applyFilter(f, marks, storeGet), [f, ready, userV]);

  const m = isItem ? byIdGet(route.id) : null;

  const featured = useMemo(() => {
    if (!(route.name === 'flow' && !act)) return [];
    return featuredPicks(marks, storeGet);
  }, [route.name, act, ready, userV]);

  const onPickTag = (tag) => {
    setF((prev) => ({ ...makeFilterState(), q: prev.q, tags: new Set([tag]) }));
    window.location.hash = '#/flow';
  };

  const secTitle = route.name === 'topic'
    ? <>{t('sec_topic')}<span className="text-[var(--color-accent)]"> · {(stats.byCategory || []).length} {t('unit_cats')}</span></>
    : route.name === 'insight'
      ? <>{t('sec_insight')}<span className="text-[var(--color-accent)]"> · {list.length} {t('unit_items')}</span></>
      : <>{t('sec_flow', { n: stats.spanDays })}<span className="text-[var(--color-accent)]"> · {list.length} {t('unit_items')}</span></>;

  return (
    <>
      {/* 顶栏 */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-rule)] bg-[var(--color-bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-6">
          <a className="flex items-baseline gap-2" href="#/flow">
            <span className="h-3.5 w-3.5 rounded-[3px] bg-[var(--color-accent)]" aria-hidden="true" />
            <b className="text-lg tracking-wide">Super Mark</b>
          </a>
          <nav className="hidden gap-5 text-sm md:flex">
            {[['flow', t('nav_flow')], ['topic', t('nav_topic')], ['insight', t('nav_insight')]].map(([k, label]) => (
              <a key={k} href={`#/${k}`} className={`transition-colors ${route.name === k ? 'font-bold text-[var(--color-accent)]' : 'text-[var(--color-muted)] hover:text-ink'}`}>{label}</a>
            ))}
          </nav>
          <span className="flex-1" />
          <button
            title={t('tip_actionable')}
            onClick={() => { setF((prev) => ({ ...prev, actionableOnly: true })); window.location.hash = '#/flow'; }}
            className="rounded-full border border-[var(--color-rule)] px-3 py-1.5 text-sm hover:border-[var(--color-accent)]">
            ▶ {t('actionable')} <b className="font-mono text-[var(--color-accent)]">{stats.actionable}</b>
          </button>
          <button onClick={() => { setLang(getLang() === 'zh' ? 'en' : 'zh'); }}
            title={t('tip_lang')} aria-label={t('tip_lang')}
            className="h-8 rounded-full border border-[var(--color-rule)] px-2.5 text-xs font-bold">{t('lang_label')}</button>
          <button onClick={cycleTheme}
            title={t('tip_theme')} aria-label={t('tip_theme')}
            className="h-8 w-8 rounded-full border border-[var(--color-rule)] text-sm">{themeIcon}</button>
        </div>
      </header>

      {/* Hero */}
      {showHero && (
        <section className={`overflow-hidden transition-all ${compact ? 'py-8' : 'py-14 md:py-20'}`}>
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            {!compact && (
              <motion.h1
                className="max-w-3xl text-3xl font-bold leading-tight md:text-5xl"
                initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                {t('hero_t1')}<br />{t('hero_t2')}
              </motion.h1>
            )}
            {!compact && <p className="mt-4 max-w-2xl text-[15px] text-[var(--color-muted)]">{t('hero_sub')}</p>}
            <div className={`mt-6 flex max-w-xl items-center gap-2.5 rounded-full border border-[var(--color-rule)] bg-[var(--color-panel)] px-4 py-2.5 focus-within:border-[var(--color-accent)]`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-[var(--color-muted)]">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                type="search" autoComplete="off" aria-label={t('search_aria')}
                placeholder={t('search_ph')}
                value={f.q}
                onChange={(e) => setF((prev) => ({ ...prev, q: e.target.value }))}
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-muted)]"
              />
            </div>
            {featured.length > 0 && (
              <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 xl:grid-cols-4">
                {featured.map((mm, i) => <PosterCard key={mm.id} m={mm} theme={theme} index={i} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 主体 */}
      <main className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
        {!isItem && (
          <>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-xl font-bold">{secTitle}</h2>
              <span className="font-mono text-xs text-[var(--color-muted)]">{list.length} / {marks.length}</span>
            </div>
            <FilterPills route={route.name} f={f} setF={setF} viewMode={viewMode} setViewMode={setViewMode} theme={theme} counts={counts} />
            <div className="mt-6">
              {!ready ? <div className="py-24 text-center text-[var(--color-muted)]">{t('loading')}</div>
                : route.name === 'topic' ? <TopicView list={list} theme={theme} viewMode={viewMode} onPickTag={onPickTag} />
                  : route.name === 'insight' ? <InsightView list={list} theme={theme} />
                    : viewMode === 'list' ? <ListView list={list} theme={theme} />
                      : list.length ? <PosterGrid list={list} theme={theme} /> : <EmptyState />}
            </div>
          </>
        )}
        {isItem && (ready ? (m
          ? <DetailView m={m} theme={theme} />
          : <div className="py-24 text-center text-lg opacity-70">{t('not_found')}</div>)
          : null)}
      </main>

      <footer className="border-t border-[var(--color-rule)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-6 font-mono text-xs text-[var(--color-muted)] md:px-6">
          <span className="tracking-widest">SUPER MARK</span>
          <span>{t('footer_stats', { total: stats.total, days: stats.spanDays })}</span>
          <span className="flex-1" />
          <span>{t('footer_local')}</span>
          <FooterCredit />
        </div>
      </footer>

      <UpdateToast pwa={pwa} />
    </>
  );
}

function byIdGet(id) {
  return marks.find((x) => x.id === id) || null;
}
