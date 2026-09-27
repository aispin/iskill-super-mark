/* 洞察视图：统计、深读工程面板、图表阵列、待办 */
import { marks as allMarks, stats as s, tax, catColor, fmtDate, platLabel } from '@/lib/data';
import { storeGet } from '@/lib/store';
import { useT, getLang } from '@/lib/i18n';
import { PosterGrid } from '@/components/Poster.jsx';
import { Bars, Donut, Heat, HBars } from '@/components/Charts.jsx';

function Stat({ v, k, accent = false }) {
  return (
    <div className="min-w-0">
      <div className={`font-mono text-2xl font-bold md:text-3xl ${accent ? 'text-[var(--color-accent)]' : ''}`}>{v}</div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">{k}</div>
    </div>
  );
}

export function InsightView({ list, theme }) {
  const t = useT();
  const shown = {};
  list.forEach((m) => { shown[m.category] = (shown[m.category] || 0) + 1; });
  const catList = tax.categories
    .map((c) => ({ id: c.id, name: c.name, color: catColor(c.id, theme), count: shown[c.id] || 0 }))
    .filter((c) => c.count > 0).sort((a, b) => b.count - a.count);

  const todo = allMarks.filter((m) => m.actionable && storeGet(m.id).readStatus !== 'done').slice(0, 8);

  const trd = allMarks.filter((m) => m.transcript);
  const deepd = allMarks.filter((m) => m.deep);
  const trChars = trd.reduce((a, m) => a + [...String((m.transcript || {}).text || '')].length, 0);

  return (
    <>
      <div className="grid grid-cols-3 gap-6 rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6 md:grid-cols-5">
        <Stat v={s.total} k={t('stat_saved')} />
        <Stat v={s.spanDays} k={t('stat_span')} />
        <Stat v={s.actionable} k={t('stat_actionable')} accent />
        <Stat v={(s.byCategory || []).length} k={t('stat_topics')} />
        <Stat v={(s.byPlatform || []).length} k={t('stat_sources')} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">{t('dp_title')}</h3>
            <span className="text-xs text-[var(--color-muted)]">{t('dp_sub')}</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Stat v={trd.length} k={t('dp_tr')} />
            <Stat v={deepd.length} k={t('dp_deep')} accent />
            <Stat v={trChars >= 10000 ? `${(trChars / 10000).toFixed(1)}${t('wan')}` : trChars} k={t('dp_chars')} />
            <Stat v={`${Math.round((deepd.length / Math.max(1, trd.length)) * 100)}%`} k={t('dp_cov')} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[var(--color-muted)]">
            {t('dp_desc')}
          </p>
        </section>

        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">{t('rhythm')}</h3>
            <span className="text-xs text-[var(--color-muted)]">{fmtDate(s.firstAt)} — {fmtDate(s.lastAt)}</span>
          </div>
          <Bars items={s.byMonth || []} h={190} label={t('by_month')} />
        </section>

        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">{t('attn')}</h3>
            <span className="text-xs text-[var(--color-muted)]">{t('attn_sub')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-8">
            <Donut items={catList} total={list.length} />
            <div className="min-w-[220px] flex-1"><HBars items={catList} /></div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">{t('when')}</h3>
            <span className="text-xs text-[var(--color-muted)]">{t('when_sub')}</span>
          </div>
          <Heat matrix={s.heat || Array.from({ length: 7 }, () => new Array(24).fill(0))} />
        </section>

        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">{t('vt')}</h3>
            <span className="text-xs text-[var(--color-muted)]">{t('vt_sub')}</span>
          </div>
          <HBars items={(s.byValueType || []).map((v) => ({ ...v, color: catColor('ai', theme) }))} />
        </section>

        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">{t('src')}</h3>
            <span className="text-xs text-[var(--color-muted)]">{t('src_sub')}</span>
          </div>
          <HBars items={(s.byPlatform || []).map((p) => ({ ...p, name: platLabel(p.id, getLang()), color: catColor('media', theme) }))} />
        </section>

        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">{t('todo_title')}</h3>
            <span className="text-xs text-[var(--color-muted)]">{t('todo_sub')}</span>
          </div>
          {todo.length
            ? <PosterGrid list={todo} theme={theme} />
            : <div className="py-8 text-center text-sm text-[var(--color-muted)]">{t('todo_done')}</div>}
        </section>
      </div>
    </>
  );
}
