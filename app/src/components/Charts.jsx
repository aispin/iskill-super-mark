/* 手写图表：柱状图用 HTML/CSS，环图与热力图用 SVG（零图表库依赖） */
import { catColor } from '@/lib/data';

export function Bars({ items, h = 168, label = '' }) {
  if (!items?.length) return null;
  const max = Math.max(...items.map((d) => d.count), 1);
  return (
    <div className="bars" style={{ '--h': `${h}px` }} role="img" aria-label={label}>
      {items.map((d) => {
        const p = Math.max(3, Math.round((d.count / max) * 100));
        const m = String(d.month || '');
        return (
          <div key={m} className="bcol" title={`${m} · ${d.count} 条`}>
            <span className="font-mono text-[10px] text-[var(--color-muted)]">{d.count}</span>
            <span className="bbar" style={{ '--p': `${p}%` }} />
            <span className="text-center font-mono text-[10px] leading-tight text-[var(--color-muted)]">
              {m.slice(0, 4)}<br /><em className="not-italic">{m.slice(5)}</em>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Donut({ items, total, size = 172 }) {
  if (!items?.length) return null;
  const cx = size / 2;
  const r = cx - 12;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="分类占比">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--color-rule)" strokeWidth="17" />
      {items.map((d) => {
        const len = (d.count / (total || 1)) * C;
        const seg = (
          <circle key={d.id} cx={cx} cy={cx} r={r} fill="none" stroke={d.color}
            strokeWidth="17" strokeDasharray={`${(len - 1.5).toFixed(2)} ${(C - len + 1.5).toFixed(2)}`}
            strokeDashoffset={(-acc).toFixed(2)} transform={`rotate(-90 ${cx} ${cx})`}>
            <title>{`${d.name} ${d.count} 条`}</title>
          </circle>
        );
        acc += len;
        return seg;
      })}
      <text x={cx} y={cx + 4} textAnchor="middle" fontSize="34" fontFamily="var(--font-mono)" fill="var(--color-ink)" style={{ fontVariantNumeric: 'tabular-nums' }}>{total}</text>
      <text x={cx} y={cx + 26} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-muted)" letterSpacing="2">条收藏</text>
    </svg>
  );
}

export function Heat({ matrix }) {
  const cell = 15, gap = 3;
  const flat = matrix.flat();
  const max = Math.max(...flat, 1);
  const w = 24 * (cell + gap) + 28;
  const h = 7 * (cell + gap) + 20;
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const cells = [];
  for (let d = 0; d < 7; d++) {
    for (let hr = 0; hr < 24; hr++) {
      const v = matrix[d]?.[hr] || 0;
      const op = v ? 0.2 + 0.8 * (v / max) : 0.07;
      cells.push(<rect key={`${d}-${hr}`} x={28 + hr * (cell + gap)} y={d * (cell + gap)} width={cell} height={cell}
        rx="2" fill="var(--color-accent)" opacity={op.toFixed(2)}>
        <title>{`周${days[d]} ${hr}:00 · ${v} 条`}</title>
      </rect>);
    }
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="收藏时间热力图" className="w-full max-w-[520px]">
      {days.map((day, d) => (
        <text key={day} x="0" y={d * (cell + gap) + cell - 2} fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-muted)">{day}</text>
      ))}
      {cells}
      {[0, 6, 12, 18, 23].map((hr) => (
        <text key={hr} x={28 + hr * (cell + gap)} y={h - 5} fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-muted)">{hr}</text>
      ))}
    </svg>
  );
}

export function HBars({ items, color }) {
  if (!items?.length) return null;
  const max = Math.max(...items.map((d) => d.count), 1);
  return (
    <div className="legend">
      {items.map((d) => {
        const c = d.color || color || catColor(d.id || 'ai', document.documentElement.dataset.theme || 'dark');
        return (
          <div key={d.name || d.id}>
            <i style={{ background: c }} />
            <span className="truncate">{d.name || d.id}</span>
            <span className="tr"><span style={{ width: `${((d.count / max) * 100).toFixed(1)}%`, background: c }} /></span>
            <span className="text-right font-mono">{d.count}</span>
          </div>
        );
      })}
    </div>
  );
}
