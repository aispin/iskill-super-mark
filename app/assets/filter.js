/* 筛选状态与过滤逻辑 */
window.SM = window.SM || {};
(function () {
  const state = {
    q: '',
    cats: new Set(),
    tags: new Set(),
    value: '',
    audience: '',
    status: '',          // unread | reading | done | archived
    starredOnly: false,
    actionableOnly: false,
    sort: 'time',        // time | rating | category
  };

  function toggle(set, v) {
    if (set.has(v)) set.delete(v); else set.add(v);
  }

  function apply(marks) {
    const q = state.q.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    let out = marks.filter((m) => {
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
        const u = SM.store.get(m.id);
        if (state.status && u.readStatus !== state.status) return false;
        if (state.starredOnly && !u.starred) return false;
      }
      return true;
    });
    if (state.sort === 'rating') {
      out = out.slice().sort((a, b) => (SM.store.get(b.id).rating || 0) - (SM.store.get(a.id).rating || 0) || String(b.sentAt).localeCompare(String(a.sentAt)));
    } else if (state.sort === 'category') {
      out = out.slice().sort((a, b) => (a.category || '').localeCompare(b.category || '') || String(b.sentAt).localeCompare(String(a.sentAt)));
    }
    return out;
  }

  function activeCount() {
    return (state.cats.size ? 1 : 0) + (state.tags.size ? 1 : 0) + (state.value ? 1 : 0)
      + (state.audience ? 1 : 0) + (state.status ? 1 : 0) + (state.starredOnly ? 1 : 0) + (state.actionableOnly ? 1 : 0);
  }
  function reset() {
    state.q = ''; state.cats.clear(); state.tags.clear();
    state.value = ''; state.audience = ''; state.status = '';
    state.starredOnly = false; state.actionableOnly = false; state.sort = 'time';
  }

  SM.filter = { state, apply, toggle, activeCount, reset };
})();
