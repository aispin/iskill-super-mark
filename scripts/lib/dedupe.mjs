// raw 层的增量合并：同指纹只保留首次记录，重复转发累加 dupCount。
export function mergeRaw(existing = [], incoming = []) {
  const byId = new Map(existing.map((it) => [it.id, { ...it }]));
  let added = 0;
  let dup = 0;

  for (const it of incoming) {
    const hit = byId.get(it.id);
    if (hit) {
      hit.dupCount = (hit.dupCount || 1) + 1;
      // 后到的可能带更完整的正文（首次转发常为空文案）
      if (!hit.rawText && it.rawText) hit.rawText = it.rawText;
      if (!hit.url && it.url) hit.url = it.url;
      dup += 1;
    } else {
      byId.set(it.id, { ...it });
      added += 1;
    }
  }

  const items = [...byId.values()].sort((a, b) => String(a.sentAt).localeCompare(String(b.sentAt)));
  return { items, added, dup, total: items.length };
}

/** 挑出还没有分析结果的条目（用于 analyze 增量） */
export function pendingItems(rawItems, enrichMap) {
  return rawItems.filter((it) => !enrichMap[it.id] || enrichMap[it.id].confidence === 0);
}
