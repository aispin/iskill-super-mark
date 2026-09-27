/* 主题视图：标签云 + 按分类分组的收藏 */
import { marks as allMarks, tax, catColor, catName } from '@/lib/data';
import { useT } from '@/lib/i18n';
import { PosterGrid, ListView, EmptyState } from '@/components/Poster.jsx';

export function TopicView({ list, theme, viewMode, onPickTag }) {
  const t = useT();
  if (!list.length) return <EmptyState />;
  const groups = new Map();
  list.forEach((m) => {
    if (!groups.has(m.category)) groups.set(m.category, []);
    groups.get(m.category).push(m);
  });
  const order = tax.categories.map((c) => c.id);
  const ids = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const tagCount = {};
  allMarks.forEach((m) => {
    for (const tg of [...(m.tags || []), ...(m.rawTags || [])]) tagCount[tg] = (tagCount[tg] || 0) + 1;
  });
  const top = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 28);

  return (
    <>
      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-base font-bold">{t('tag_cloud')}</h3>
          <span className="text-xs text-[var(--color-muted)]">{t('tag_meta', { n: Object.keys(tagCount).length })}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {top.map(([tg, n]) => (
            <button key={tg} onClick={() => onPickTag(tg)}
              className="rounded-full border border-[var(--color-rule)] px-3 py-1 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">
              {tg}<span className="ml-1 font-mono text-xs text-[var(--color-muted)]">{n}</span>
            </button>
          ))}
        </div>
      </section>
      {ids.map((cid) => {
        const items = groups.get(cid).sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
        const subs = {};
        items.forEach((m) => { if (m.subCategory) subs[m.subCategory] = (subs[m.subCategory] || 0) + 1; });
        const subLine = Object.entries(subs).sort((a, b) => b[1] - a[1]).slice(0, 4)
          .map(([s2, n]) => `${s2} ${n}`).join(' / ');
        return (
          <section key={cid} className="mb-10">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-base font-bold" style={{ color: catColor(cid, theme) }}>{catName(cid)}</h3>
              <span className="text-xs text-[var(--color-muted)]">{items.length} {t('unit_items')}{subLine ? ` · ${subLine}` : ''}</span>
            </div>
            {viewMode === 'list'
              ? <ListView list={items} theme={theme} />
              : <PosterGrid list={items} theme={theme} />}
          </section>
        );
      })}
    </>
  );
}
