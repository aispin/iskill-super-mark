import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { marks, tax, stats, catColor } from '@/lib/data';
import { makeFilterState, applyFilter, activeFilterCount, featuredPicks } from '@/lib/filter';
import { storeInit, storeGet, useUserVersion } from '@/lib/store';
import { usePwa } from '@/lib/pwa.jsx';
import { PosterCard, PosterGrid, ListView, EmptyState } from '@/components/Poster.jsx';
import { TopicView } from '@/components/TopicView.jsx';
import { InsightView } from '@/components/InsightView.jsx';
import { DetailView } from '@/components/DetailView.jsx';

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
  const act = activeFilterCount(f);
  const cats = tax.categories.filter((c) => counts[c.id]);
  const toggleCat = (id) => {
    const next = new Set(f.cats);
    if (next.has(id)) next.delete(id); else next.add(id);
    setF({ ...f, cats: next });
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {cats.map((c) => (
          <Pill key={c.id} on={f.cats.has(c.id)} onClick={() => toggleCat(c.id)}>
            <Dot color={catColor(c.id, theme)} />{c.name}<span className="ml-1 font-mono text-xs opacity-70">{counts[c.id]}</span>
          </Pill>
        ))}
        <span className="flex-1" />
        <span className="flex overflow-hidden rounded-full border border-[var(--color-rule)]" role="group" aria-label="视图切换">
          {[['poster', '海报'], ['list', '列表']].map(([v, label]) => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`px-3 py-1 text-sm ${viewMode === v ? 'bg-[var(--color-accent)] font-bold text-[var(--color-accent-ink)]' : 'text-[var(--color-muted)]'}`}>{label}</button>
          ))}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {act > 0 && <Pill ghost onClick={() => setF({ ...makeFilterState(), q: f.q })}>清除 ✕</Pill>}
        {act > 0 && <Sep />}
        {(tax.valueTypes || []).filter((v) => counts.values[v.id]).map((v) => (
          <Pill key={v.id} on={f.value === v.id} onClick={() => setF({ ...f, value: f.value === v.id ? '' : v.id })}>{v.name}</Pill>
        ))}
        {act > 0 && <Sep />}
        <Pill on={f.actionableOnly} onClick={() => setF({ ...f, actionableOnly: !f.actionableOnly })}>▶ 可做</Pill>
        <Pill on={f.starredOnly} onClick={() => setF({ ...f, starredOnly: !f.starredOnly })}>★ 星标</Pill>
        <Sep />
        {[['unread', '未读'], ['reading', '在读'], ['done', '已读']].map(([k, v]) => (
          <Pill key={k} on={f.status === k} onClick={() => setF({ ...f, status: f.status === k ? '' : k })}>{v}</Pill>
        ))}
        <Sep />
        {[['time', '最新'], ['rating', '评分'], ['category', '主题']].map(([k, v]) => (
          <Pill key={k} on={f.sort === k} onClick={() => setF({ ...f, sort: k })}>{v}</Pill>
        ))}
      </div>
    </>
  );
}
const Sep = () => <span className="h-4 w-px bg-[var(--color-rule)]" />;

/* ---------- 底部更新提示 ---------- */
function UpdateToast({ pwa }) {
  return (
    <AnimatePresence>
      {pwa.show && (
        <motion.div
          id="pwa-toast" role="status"
          className="fixed bottom-[18px] left-1/2 z-50 flex max-w-[min(92vw,460px)] -translate-x-1/2 items-center gap-3 rounded-lg border border-white/10 bg-stone-900 px-3.5 py-2.5 text-[13px] text-stone-50 shadow-2xl"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
        >
          <span className="flex-1">{pwa.text}</span>
          <button onClick={pwa.onRefresh} className="rounded bg-[var(--color-accent)] px-2.5 py-1 font-bold text-[var(--color-accent-ink)]">刷新</button>
          <button onClick={pwa.onDismiss} aria-label="关闭" className="px-1 opacity-60 hover:opacity-100">✕</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- App ---------- */
export default function App() {
  const [route, setRoute] = useState(parseHash);
  const [f, setF] = useState(makeFilterState);
  const [viewMode, setViewMode] = useState('poster');
  const [theme, setTheme] = useState(() => localStorage.getItem('supermark.theme') || 'dark');
  const [ready, setReady] = useState(false);
  const userV = useUserVersion(); // 用户标注（星标/已读/评分）变化时联动筛选结果
  const pwa = usePwa();

  useEffect(() => { storeInit().then(() => setReady(true)); }, []);
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const applyTheme = (t) => {
    setTheme(t);
    localStorage.setItem('supermark.theme', t);
    document.documentElement.dataset.theme = t;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = t === 'dark' ? '#0c0a09' : '#ffffff';
  };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = theme === 'dark' ? '#0c0a09' : '#ffffff';
  }, [theme]);

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

  const onPickTag = (t) => {
    setF((prev) => ({ ...makeFilterState(), q: prev.q, tags: new Set([t]) }));
    window.location.hash = '#/flow';
  };

  const secTitle = route.name === 'topic'
    ? <>我收藏的主题<span className="text-[var(--color-accent)]"> · {(stats.byCategory || []).length} 类</span></>
    : route.name === 'insight'
      ? <>注意力洞察<span className="text-[var(--color-accent)]"> · {list.length} 条</span></>
      : <>近 {stats.spanDays} 天的收藏<span className="text-[var(--color-accent)]"> · {list.length} 条</span></>;

  return (
    <>
      {/* 顶栏 */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-rule)] bg-[var(--color-bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-6">
          <a className="flex items-baseline gap-2" href="#/flow">
            <span className="h-3.5 w-3.5 rounded-[3px] bg-[var(--color-accent)]" aria-hidden="true" />
            <b className="text-lg tracking-wide">收藏册</b>
            <i className="font-mono text-xs not-italic text-[var(--color-muted)]">super mark</i>
          </a>
          <nav className="hidden gap-5 text-sm md:flex">
            {[['flow', '时间流'], ['topic', '主题'], ['insight', '洞察']].map(([k, label]) => (
              <a key={k} href={`#/${k}`} className={`transition-colors ${route.name === k ? 'font-bold text-[var(--color-accent)]' : 'text-[var(--color-muted)] hover:text-ink'}`}>{label}</a>
            ))}
          </nav>
          <span className="flex-1" />
          <button
            title="只看还能做的事"
            onClick={() => { setF((prev) => ({ ...prev, actionableOnly: true })); window.location.hash = '#/flow'; }}
            className="rounded-full border border-[var(--color-rule)] px-3 py-1.5 text-sm hover:border-[var(--color-accent)]">
            ▶ 可做 <b className="font-mono text-[var(--color-accent)]">{stats.actionable}</b>
          </button>
          <button onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
            title="切换明暗" aria-label="切换明暗"
            className="h-8 w-8 rounded-full border border-[var(--color-rule)] text-sm">{theme === 'dark' ? '☀' : '☾'}</button>
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
                把随手收藏的内容<br />变成一本可检索、可回看的收藏册
              </motion.h1>
            )}
            {!compact && <p className="mt-4 max-w-2xl text-[15px] text-[var(--color-muted)]">微信视频号里的随手收藏，按主题归好、按内容读懂，随时回来翻。</p>}
            <div className={`mt-6 flex max-w-xl items-center gap-2.5 rounded-full border border-[var(--color-rule)] bg-[var(--color-panel)] px-4 py-2.5 focus-within:border-[var(--color-accent)]`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-[var(--color-muted)]">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                type="search" autoComplete="off" aria-label="搜索收藏内容"
                placeholder="搜标题、摘要、要点、原文…"
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
              {!ready ? <div className="py-24 text-center text-[var(--color-muted)]">正在翻阅收藏册…</div>
                : route.name === 'topic' ? <TopicView list={list} theme={theme} viewMode={viewMode} onPickTag={onPickTag} />
                  : route.name === 'insight' ? <InsightView list={list} theme={theme} />
                    : viewMode === 'list' ? <ListView list={list} theme={theme} />
                      : list.length ? <PosterGrid list={list} theme={theme} /> : <EmptyState />}
            </div>
          </>
        )}
        {isItem && (ready ? (m
          ? <DetailView m={m} theme={theme} />
          : <div className="py-24 text-center text-lg opacity-70">没找到这条</div>)
          : null)}
      </main>

      <footer className="border-t border-[var(--color-rule)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-6 font-mono text-xs text-[var(--color-muted)] md:px-6">
          <span className="tracking-widest">SUPER MARK</span>
          <span>收录 <b>{stats.total}</b> 条 · 跨度 {stats.spanDays} 天</span>
          <span className="flex-1" />
          <span>本地优先 · 数据不出机器</span>
        </div>
      </footer>

      <UpdateToast pwa={pwa} />
    </>
  );
}

function byIdGet(id) {
  return marks.find((x) => x.id === id) || null;
}
