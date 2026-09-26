/* 筛选状态与过滤逻辑（纯函数化，便于 React 使用） */
export function makeFilterState() {
  return {
    q: '', cats: new Set(), tags: new Set(), value: '', audience: '',
    status: '', starredOnly: false, actionableOnly: false, sort: 'time',
  };
}

export function applyFilter(state, allMarks, userGet) {
  const q = state.q.trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  let out = allMarks.filter((m) => {
    if (state.cats.size && !state.cats.has(m.category)) return false;
    if (state.tags.size) {
      const all = [...(m.tags || []), ...(m.rawTags || [])];
      if (![...state.tags].some((t) => all.includes(t))) return false;
    }
    if (state.value && m.valueType !== state.value) return false;
    if (state.audience && !(m.audience || []).includes(state.audience)) return false;
    if (state.actionableOnly && !m.actionable) return false;
    if (state.q && !terms.every((t) => m._q.includes(t))) return false;
    if (state.status || state.starredOnly) {
      const u = userGet(m.id);
      if (state.status && u.readStatus !== state.status) return false;
      if (state.starredOnly && !u.starred) return false;
    }
    return true;
  });
  if (state.sort === 'rating') {
    out = out.slice().sort((a, b) => (userGet(b.id).rating || 0) - (userGet(a.id).rating || 0) || String(b.sentAt).localeCompare(String(a.sentAt)));
  } else if (state.sort === 'category') {
    out = out.slice().sort((a, b) => (a.category || '').localeCompare(b.category || '') || String(b.sentAt).localeCompare(String(a.sentAt)));
  }
  return out;
}

export function activeFilterCount(state) {
  return (state.cats.size ? 1 : 0) + (state.tags.size ? 1 : 0) + (state.value ? 1 : 0)
    + (state.audience ? 1 : 0) + (state.status ? 1 : 0) + (state.starredOnly ? 1 : 0) + (state.actionableOnly ? 1 : 0);
}

export const timeOrdered = (allMarks) => [...allMarks].sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));

/** 相关收藏：同分类打底，标签重叠加分，取 4 条 */
export function relatedMarks(m, allMarks) {
  const tags = new Set(m.tags || []);
  return allMarks
    .filter((x) => x.id !== m.id)
    .map((x) => {
      let score = 0;
      if (x.category === m.category) score += 2;
      if (m.subCategory && x.subCategory === m.subCategory) score += 1;
      for (const t of x.tags || []) if (tags.has(t)) score += 1;
      return { x, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || String(b.x.sentAt).localeCompare(String(a.x.sentAt)))
    .slice(0, 4)
    .map((r) => r.x);
}

/** 编辑精选：已深读 / 星标 / 高评分优先（避免与网格开头简单重复） */
export function featuredPicks(allMarks, userGet) {
  const byTime = timeOrdered(allMarks);
  const picks = byTime.filter((m) => m.deep || userGet(m.id).starred || (userGet(m.id).rating || 0) >= 4);
  return (picks.length >= 4 ? picks : byTime).slice(0, 4);
}
