/* 海报卡：2:3 竖版，分类色渐变 + 几何母题 + 标题排版（没有图，就把排版当图） */
import { motion } from 'motion/react';
import { posterVars, posterGlyph, titleSize, platLabel, fmtShort, no, catColor } from '@/lib/data';
import { storeGet } from '@/lib/useUser';

export function PosterCard({ m, theme, index = 0, animate = true }) {
  useUserVersion(); // 星标徽章随标注刷新
  const u = storeGet(m.id);
  const style = { ...posterVars(m.id, m.category, theme), '--tf': `${titleSize(m.title)}px` };
  const inner = (
    <>
      <span className="poster-face" data-g={posterGlyph(m.id)}>
        <span className="absolute inset-x-3 top-3 flex items-start justify-between text-[10px] tracking-wider text-white/85">
          <span className="flex gap-1.5">
            <span className="rounded-sm bg-black/30 px-1.5 py-0.5">{platLabel(m.sourcePlatform)}</span>
            {m.actionable && <span className="rounded-sm bg-[var(--color-accent)] px-1.5 py-0.5 font-bold text-[var(--color-accent-ink)]">可做</span>}
            {m.deep && <span className="rounded-sm bg-black/55 px-1.5 py-0.5 text-white">深读</span>}
          </span>
          <span className="font-mono opacity-80">{no(m)}</span>
        </span>
        <span className="relative z-10 line-clamp-4 font-semibold leading-snug text-white drop-shadow" style={{ fontSize: 'var(--tf)' }}>{m.title}</span>
        {u.starred && <span className="absolute right-3 bottom-3 z-10 text-amber-300" aria-label="已加星">★</span>}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        <span style={{ color: catColor(m.category, theme) }}>{m.categoryName}</span>
        <span>·</span>
        <span>{fmtShort(m.sentAt)}</span>
      </span>
    </>
  );
  const cls = 'poster-card group';
  if (!animate) return <a className={cls} href={`#/item/${encodeURIComponent(m.id)}`} style={style} title={m.title}>{inner}</a>;
  return (
    <motion.a
      className={cls}
      href={`#/item/${encodeURIComponent(m.id)}`}
      style={style}
      title={m.title}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.04, ease: 'easeOut' }}
    >
      {inner}
    </motion.a>
  );
}

export function PosterGrid({ list, theme, className = '' }) {
  if (!list?.length) return <EmptyState />;
  return (
    <div className={`grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-4 ${className}`}>
      {list.map((m, i) => <PosterCard key={m.id} m={m} theme={theme} index={i} />)}
    </div>
  );
}

export function EntryRow({ m, theme, index = 0 }) {
  useUserVersion();
  const u = storeGet(m.id);
  const tags = (m.tags || []).slice(0, 3);
  return (
    <motion.a
      href={`#/item/${encodeURIComponent(m.id)}`}
      className="flex items-start gap-4 border-b border-[var(--color-rule)] px-2 py-4 transition-colors hover:bg-[var(--color-panel)]"
      style={catStyleVars(m, theme)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.035, ease: 'easeOut' }}
    >
      <span className="w-9 shrink-0 pt-0.5 font-mono text-xs text-[var(--color-muted)]">{no(m)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{m.title}</span>
        <span className="mt-0.5 line-clamp-1 block text-sm text-[var(--color-muted)]">{m.summary || m.rawText || ''}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="tag cat">{m.categoryName}</span>
          {tags.map((t) => <span key={t} className="tag">{t}</span>)}
          {m.actionable && <span className="flag">▶ 可做</span>}
          {u.starred && <span className="text-amber-400">★</span>}
        </span>
      </span>
      <span className="shrink-0 pt-0.5 text-right font-mono text-xs text-[var(--color-muted)]">
        {fmtShort(m.sentAt)}
        <em className="mt-0.5 block not-italic">{platLabel(m.sourcePlatform)}</em>
      </span>
    </motion.a>
  );
}

export function ListView({ list, theme }) {
  if (!list?.length) return <EmptyState />;
  return <div>{list.map((m, i) => <EntryRow key={m.id} m={m} theme={theme} index={i} />)}</div>;
}

export function EmptyState() {
  return (
    <div className="py-24 text-center">
      <div className="text-lg font-semibold opacity-70">这一栏暂时是空的</div>
      <div className="mt-2 text-sm text-[var(--color-muted)]">换个筛选条件，或者在微信里再收藏几条。</div>
    </div>
  );
}

function catStyleVars(m, theme) {
  // 轻量版：只注入分类色供 .tag.cat 使用
  const vars = posterVars(m.id, m.category, theme);
  return { '--cat': vars['--cat'], '--cat-soft': vars['--cat-soft'], '--cat-line': vars['--cat-line'] };
}
