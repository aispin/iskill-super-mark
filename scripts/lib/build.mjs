// 合并 raw（事实层）+ enrich（分析层）→ 运行时数据 marks.js / marks.json + 统计 stats.js
import fs from 'node:fs';
import path from 'node:path';
import { loadTaxonomy, categoryById } from './taxonomy.mjs';

const readJson = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);
const write = (p, s) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s, 'utf8');
};

export function buildMarks(dir) {
  const dataDir = path.join(dir, 'data');
  const raw = readJson(path.join(dataDir, 'raw.json'), { items: [] });
  const enrichFile = readJson(path.join(dataDir, 'enrich.json'), {});
  const enrich = enrichFile.items || enrichFile;
  const tax = loadTaxonomy(readJson(path.join(dataDir, 'taxonomy.json'), null));

  const marks = raw.items.map((it) => {
    const e = enrich[it.id] || {};
    const cat = categoryById(tax, e.category || 'other');
    return {
      id: it.id,
      sourceType: it.sourceType,
      sourcePlatform: it.sourcePlatform,
      sender: it.sender,
      sentAt: it.sentAt,
      url: it.url || '',
      rawText: it.rawText || '',
      rawTags: it.rawTags || [],
      dupCount: it.dupCount || 1,
      // 分析层
      title: e.title || (it.rawText ? it.rawText.slice(0, 24) : (it.url ? '(无文案链接)' : '(空)')),
      summary: e.summary || '',
      keyPoints: e.keyPoints || [],
      category: cat.id,
      categoryName: cat.name,
      categoryColor: cat.color,
      subCategory: e.subCategory || '',
      tags: e.tags || [],
      audience: e.audience || [],
      valueType: e.valueType || '',
      actionable: !!e.actionable,
      actionHint: e.actionHint || '',
      confidence: typeof e.confidence === 'number' ? e.confidence : 0,
      enriched: !!e.title,
    };
  });

  marks.sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
  return { marks, tax };
}

export function buildStats(marks, tax, enrichPending = 0) {
  const bump = (map, k) => (map[k] = (map[k] || 0) + 1);
  const byCategory = {};
  const byPlatform = {};
  const byValueType = {};
  const byAudience = {};
  const byMonth = {};
  const tagCount = {};
  const heat = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let actionable = 0;
  let withUrl = 0;

  for (const m of marks) {
    bump(byCategory, m.category);
    bump(byPlatform, m.sourcePlatform);
    if (m.valueType) bump(byValueType, m.valueType);
    for (const a of m.audience) bump(byAudience, a);
    const d = new Date(m.sentAt);
    if (!Number.isNaN(d.getTime())) {
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      bump(byMonth, mk);
      heat[d.getDay()][d.getHours()] += 1;
    }
    for (const t of [...(m.tags || []), ...(m.rawTags || [])]) bump(tagCount, t);
    if (m.actionable) actionable += 1;
    if (m.url) withUrl += 1;
  }

  const toList = (obj, extra = {}) =>
    Object.entries(obj)
      .map(([id, count]) => ({ id, count, ...(extra[id] || {}) }))
      .sort((a, b) => b.count - a.count);

  const catMeta = Object.fromEntries(tax.categories.map((c) => [c.id, { name: c.name, color: c.color }]));
  const valMeta = Object.fromEntries((tax.valueTypes || []).map((v) => [v.id, { name: v.name }]));
  const audMeta = Object.fromEntries((tax.audiences || []).map((v) => [v.id, { name: v.name }]));

  const times = marks.map((m) => new Date(m.sentAt).getTime()).filter((t) => !Number.isNaN(t)).sort((a, b) => a - b);

  return {
    total: marks.length,
    enriched: marks.filter((m) => m.enriched).length,
    pending: enrichPending,
    actionable,
    withUrl,
    spanDays: times.length ? Math.max(1, Math.round((times[times.length - 1] - times[0]) / 86400000) + 1) : 0,
    firstAt: times.length ? new Date(times[0]).toISOString() : '',
    lastAt: times.length ? new Date(times[times.length - 1]).toISOString() : '',
    byCategory: toList(byCategory, catMeta),
    byPlatform: toList(byPlatform),
    byValueType: toList(byValueType, valMeta),
    byAudience: toList(byAudience, audMeta),
    byMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
    topTags: toList(tagCount).slice(0, 40),
    heat,
    builtAt: new Date().toISOString(),
  };
}

export function writeOutputs(dir, { marks, tax }, stats) {
  const dataDir = path.join(dir, 'data');
  const payload = { version: 1, taxonomy: tax, marks, stats };
  write(path.join(dataDir, 'marks.js'), `window.SUPERMARK_DATA = ${JSON.stringify(payload)};\n`);
  write(path.join(dataDir, 'marks.json'), JSON.stringify(payload, null, 2));
  write(path.join(dataDir, 'stats.js'), `window.SUPERMARK_STATS = ${JSON.stringify(stats)};\n`);
  return payload;
}
