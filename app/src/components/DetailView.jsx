/* 详情视图：票根式详情 + 深读段落 + 转写稿 + 相关收藏 + 用户标注 + 上下条导航 */
import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { byId, catVars, catColor, fmtDate, fmtTime, platLabel, valName, audName, no, marks as allMarks } from '@/lib/data';
import { storeGet, storeSet, useUserVersion } from '@/lib/store';
import { useT, getLang } from '@/lib/i18n';
import { timeOrdered, relatedMarks } from '@/lib/filter';
import { PosterCard } from '@/components/Poster.jsx';

function DeepBlock({ title, children }) {
  return (
    <div className="mt-5 rounded-lg border border-[var(--color-rule)] bg-[var(--color-panel)] p-4">
      <h4 className="mb-2 text-xs font-bold tracking-widest text-[var(--color-accent)]">{title}</h4>
      {children}
    </div>
  );
}

export function DetailView({ m, theme }) {
  const t = useT();
  useUserVersion();
  const u = storeGet(m.id);
  const noteRef = useRef(null);

  // 键盘导航：← 较新 / → 较旧（输入框聚焦时忽略）
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const tg = e.target;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
      const ordered = timeOrdered(allMarks);
      const i = ordered.findIndex((x) => x.id === m.id);
      if (i < 0) return;
      const target = e.key === 'ArrowLeft' ? ordered[i - 1] : ordered[i + 1];
      if (target) window.location.hash = `#/item/${encodeURIComponent(target.id)}`;
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [m.id]);

  const deep = m.deep || null;
  const tr = m.transcript || null;
  const tags = [...(m.tags || []), ...(m.rawTags || [])];
  const rel = relatedMarks(m, allMarks);
  const ordered = timeOrdered(allMarks);
  const idx = ordered.findIndex((x) => x.id === m.id);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const STATUS = [['unread', t('unread')], ['reading', t('reading')], ['done', t('done')], ['archived', t('archived')]];

  return (
    <motion.article
      className="mx-auto max-w-3xl"
      style={catVars(m.category, theme)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <a className="inline-block text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]" href="#/flow">{t('back')}</a>

      <div className="mt-4">
        <div className="font-mono text-xs tracking-widest text-[var(--color-muted)]">NO.{no(m)}</div>
        <h1 className="mt-2 text-2xl font-bold leading-snug md:text-3xl">{m.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
          <span className="font-mono">{fmtDate(m.sentAt)} {fmtTime(m.sentAt)}</span>
          <span style={{ color: catColor(m.category, theme) }}>{m.categoryName}{m.subCategory ? ` · ${m.subCategory}` : ''}</span>
          <span>{platLabel(m.sourcePlatform, getLang())}</span>
          {m.valueType && <span>{valName(m.valueType)}</span>}
          {(m.audience || []).length > 0 && <span>{t('to_audience', { names: m.audience.map((a) => audName(a)).join('/') })}</span>}
          {m.transcript && <span className="flag">{t('transcribed')}</span>}
          {m.deep && <span className="flag">{t('deepened')}</span>}
        </div>
      </div>

      <blockquote className="mt-5 border-l-[3px] border-[var(--color-accent)] pl-4 text-[15px] leading-relaxed">{m.summary}</blockquote>

      {(m.keyPoints || []).length > 0 && (
        <ul className="mt-5 space-y-2 text-[15px] leading-relaxed">
          {m.keyPoints.map((p, i) => <li key={i} className="flex gap-2"><span className="text-[var(--color-accent)]">▸</span><span>{p}</span></li>)}
        </ul>
      )}

      {m.actionHint && (
        <p className="mt-5 rounded-lg bg-[var(--cat-soft)] p-4 text-sm leading-relaxed">
          <b className="mr-2 font-mono text-xs tracking-widest text-[var(--color-accent)]">ACTION</b>{m.actionHint}
        </p>
      )}

      {deep && (
        <div className="mt-8">
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="text-base font-bold">{t('deep_title')}</h3>
            <span className="text-xs text-[var(--color-muted)]">{t('deep_sub')}</span>
          </div>
          {deep.thesis && <DeepBlock title={t('deep_thesis')}><p className="text-sm leading-relaxed">{deep.thesis}</p></DeepBlock>}
          {(deep.steps || []).length > 0 && (
            <DeepBlock title={t('deep_steps')}>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">{deep.steps.map((s2, i) => <li key={i}>{s2}</li>)}</ol>
            </DeepBlock>
          )}
          {(deep.facts || []).length > 0 && (
            <DeepBlock title={t('deep_facts')}>
              <ul className="space-y-1.5 text-sm leading-relaxed">{deep.facts.map((s2, i) => <li key={i} className="flex gap-2"><span className="text-[var(--color-muted)]">·</span><span>{s2}</span></li>)}</ul>
            </DeepBlock>
          )}
          {deep.takeaway && <DeepBlock title={t('deep_takeaway')}><p className="text-sm leading-relaxed">{deep.takeaway}</p></DeepBlock>}
          {(deep.caveats || []).length > 0 && (
            <DeepBlock title={t('deep_caveats')}>
              <ul className="space-y-1.5 text-sm leading-relaxed opacity-70">{deep.caveats.map((s2, i) => <li key={i} className="flex gap-2"><span>·</span><span>{s2}</span></li>)}</ul>
            </DeepBlock>
          )}
          {(deep.related || []).length > 0 && (
            <DeepBlock title={t('deep_related')}>
              <ul className="space-y-1.5 text-sm leading-relaxed">{deep.related.map((s2, i) => <li key={i} className="flex gap-2"><span>·</span><span>{s2}</span></li>)}</ul>
            </DeepBlock>
          )}
        </div>
      )}

      {m.rawText && (
        <section className="mt-8">
          <div className="mb-2 flex items-baseline justify-between"><h4 className="text-sm font-bold">{t('raw_title')}</h4></div>
          <div className="raw rounded-lg border border-[var(--color-rule)] p-4">{m.rawText}</div>
        </section>
      )}

      {tr && (
        <section className="mt-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h4 className="text-sm font-bold">{t('tr_title')}</h4>
            <span className="text-xs text-[var(--color-muted)]">{tr.engine || t('tr_local')}{tr.durationSec ? ` · ${t('tr_min', { n: Math.round(tr.durationSec / 60) })}` : ''}{tr.audioPath ? ` · ${t('tr_archived')}` : ''}</span>
          </div>
          <details className="rounded-lg border border-[var(--color-rule)] p-4">
            <summary className="cursor-pointer text-sm text-[var(--color-muted)]">{t('tr_expand', { n: [...String(tr.text || '')].length })}</summary>
            <div className="raw mt-3">{tr.text || ''}</div>
          </details>
        </section>
      )}

      {rel.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h4 className="text-sm font-bold">{t('related')}</h4>
            <span className="text-xs text-[var(--color-muted)]">{t('related_sub')}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 xl:grid-cols-4">
            {rel.map((x, i) => <PosterCard key={x.id} m={x} theme={theme} index={i} animate={false} />)}
          </div>
        </section>
      )}

      {tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">{tags.map((tg) => <span key={tg} className="tag">{tg}</span>)}</div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-[var(--color-rule)] pt-6">
        {m.url && <a className="rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-sm font-bold text-[var(--color-accent-ink)]" href={m.url} target="_blank" rel="noopener">{t('open_original')}</a>}
        <button onClick={() => storeSet(m.id, { starred: !storeGet(m.id).starred })}
          className={`rounded-full border px-4 py-1.5 text-sm ${u.starred ? 'border-amber-400 text-amber-400' : 'border-[var(--color-rule)]'}`}>
          {u.starred ? t('starred_y') : t('add_star')}
        </button>
        {STATUS.map(([k, v]) => (
          <button key={k} onClick={() => storeSet(m.id, { readStatus: k })}
            className={`rounded-full border px-3 py-1.5 text-sm ${u.readStatus === k ? 'border-[var(--color-accent)] bg-[var(--color-accent)] font-bold text-[var(--color-accent-ink)]' : 'border-[var(--color-rule)]'}`}>{v}</button>
        ))}
        <span className="ml-2 text-xs text-[var(--color-muted)]">{t('rating')}</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => storeSet(m.id, { rating: n })}
            className={`h-7 w-7 rounded-full border font-mono text-xs ${(u.rating || 0) >= n ? 'border-[var(--color-accent)] bg-[var(--color-accent)] font-bold text-[var(--color-accent-ink)]' : 'border-[var(--color-rule)] text-[var(--color-muted)]'}`}>{n}</button>
        ))}
        <textarea
          ref={noteRef}
          defaultValue={u.note || ''}
          onBlur={(e) => { if (e.target.value !== (u.note || '')) storeSet(m.id, { note: e.target.value }); }}
          placeholder={t('note_ph')}
          className="mt-3 w-full rounded-lg border border-[var(--color-rule)] bg-transparent p-3 text-sm outline-none focus:border-[var(--color-accent)]"
          rows={2}
        />
      </div>

      {(prev || next) && (
        <nav className="mt-8 mb-4 grid grid-cols-2 gap-4 border-t border-[var(--color-rule)] pt-6">
          <div>{prev && (
            <a href={`#/item/${encodeURIComponent(prev.id)}`} className="block min-w-0 group">
              <span className="text-xs text-[var(--color-muted)]">{t('newer')}</span>
              <b className="mt-1 block truncate text-sm group-hover:text-[var(--color-accent)]">{prev.title}</b>
            </a>
          )}</div>
          <div className="text-right">{next && (
            <a href={`#/item/${encodeURIComponent(next.id)}`} className="block min-w-0 group">
              <span className="text-xs text-[var(--color-muted)]">{t('older')}</span>
              <b className="mt-1 block truncate text-sm group-hover:text-[var(--color-accent)]">{next.title}</b>
            </a>
          )}</div>
        </nav>
      )}
    </motion.article>
  );
}
