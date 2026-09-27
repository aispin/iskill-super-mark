/* 洞察视图：统计、深读工程面板、图表阵列、待办 */
import { marks as allMarks, stats as s, tax, catColor, fmtDate, platLabel } from '@/lib/data';
import { storeGet } from '@/lib/store';
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
        <Stat v={s.total} k="条收藏" />
        <Stat v={s.spanDays} k="天跨度" />
        <Stat v={s.actionable} k="可行动" accent />
        <Stat v={(s.byCategory || []).length} k="个主题" />
        <Stat v={(s.byPlatform || []).length} k="个来源" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">深读工程</h3>
            <span className="text-xs text-[var(--color-muted)]">听一遍 → 读一遍的 AI 管线</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Stat v={trd.length} k="已转写" />
            <Stat v={deepd.length} k="已深读" accent />
            <Stat v={trChars >= 10000 ? `${(trChars / 10000).toFixed(1)} 万` : trChars} k="转写字数" />
            <Stat v={`${Math.round((deepd.length / Math.max(1, trd.length)) * 100)}%`} k="深读覆盖" />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[var(--color-muted)]">
            音频本地转写 → 逐条结构化深读（论点/步骤/事实/结论），数据不出机器。
          </p>
        </section>

        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">收藏节奏</h3>
            <span className="text-xs text-[var(--color-muted)]">{fmtDate(s.firstAt)} — {fmtDate(s.lastAt)}</span>
          </div>
          <Bars items={s.byMonth || []} h={190} label="按月收藏量" />
        </section>

        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">注意力分布</h3>
            <span className="text-xs text-[var(--color-muted)]">一级分类占比</span>
          </div>
          <div className="flex flex-wrap items-center gap-8">
            <Donut items={catList} total={list.length} />
            <div className="min-w-[220px] flex-1"><HBars items={catList} /></div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">什么时候在收藏</h3>
            <span className="text-xs text-[var(--color-muted)]">星期 × 小时</span>
          </div>
          <Heat matrix={s.heat || Array.from({ length: 7 }, () => new Array(24).fill(0))} />
        </section>

        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">价值类型</h3>
            <span className="text-xs text-[var(--color-muted)]">你存下来的多半是哪一类</span>
          </div>
          <HBars items={(s.byValueType || []).map((v) => ({ ...v, color: catColor('ai', theme) }))} />
        </section>

        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">来源构成</h3>
            <span className="text-xs text-[var(--color-muted)]">内容主要从哪来</span>
          </div>
          <HBars items={(s.byPlatform || []).map((p) => ({ ...p, name: platLabel(p.id), color: catColor('media', theme) }))} />
        </section>

        <section className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-panel)] p-6 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-base font-bold">看了还没做</h3>
            <span className="text-xs text-[var(--color-muted)]">标记了「可做」但还没读完</span>
          </div>
          {todo.length
            ? <PosterGrid list={todo} theme={theme} />
            : <div className="py-8 text-center text-sm text-[var(--color-muted)]">全部消化完了</div>}
        </section>
      </div>
    </>
  );
}
