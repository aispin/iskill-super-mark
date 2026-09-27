/* i18n 内核：中/英双语，默认跟随系统语言，手动选择后记忆。
   极简外部 store（与 store.js 同款模式），组件用 useT() 取 { t, lang, setLang }，
   非组件模块直接调 t()。仅覆盖 UI 文案；分类名/标签等数据内容保持原文。 */
import { useSyncExternalStore } from 'react';

const LS_KEY = 'supermark.lang';

function detect() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch { /* 忽略 */ }
  const nav = typeof navigator !== 'undefined' ? (navigator.language || navigator.userLanguage || 'zh') : 'zh';
  return String(nav).toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let lang = detect();
const listeners = new Set();

export function getLang() {
  return lang;
}

export function setLang(l) {
  if (l !== 'zh' && l !== 'en') return;
  lang = l;
  try { localStorage.setItem(LS_KEY, l); } catch { /* 忽略 */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  listeners.forEach((f) => f());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useLang() {
  return useSyncExternalStore(subscribe, getLang);
}

/* ---------- 字典 ---------- */
const DICT = {
  zh: {
    nav_flow: '时间流', nav_topic: '主题', nav_insight: '洞察',
    view_poster: '海报', view_list: '列表',
    clear: '清除 ✕', actionable: '可做', starred: '星标',
    unread: '未读', reading: '在读', done: '已读', archived: '归档',
    sort_time: '最新', sort_rating: '评分', sort_category: '主题',
    tip_actionable: '只看还能做的事', tip_theme: '切换明暗（跟随系统 / 亮 / 暗）',
    tip_lang: '切换语言',
    hero_t1: '把随手收藏的碎片化内容', hero_t2: '变成一本可检索、可回看的收藏册',
    hero_sub: '微信视频号里的随手收藏，按主题归好、按内容读懂，随时回来翻。',
    search_ph: '搜标题、摘要、要点、原文…', search_aria: '搜索收藏内容',
    sec_flow: '近 {n} 天的收藏', sec_topic: '我收藏的主题', sec_insight: '注意力洞察',
    unit_items: '条', unit_cats: '类',
    loading: '正在翻阅收藏册…', not_found: '没找到这条',
    footer_stats: '收录 {total} 条 · 跨度 {days} 天', footer_local: '本地优先 · 数据不出机器',
    btn_refresh: '刷新', app_updated: '应用有新版本，刷新后生效', data_updated: '收藏数据已更新，刷新查看新内容',
    badge_actionable: '可做', badge_deep: '深读', starred_aria: '已加星',
    empty_title: '这一栏暂时是空的', empty_hint: '换个筛选条件，或者再收藏几条。',
    back: '← 返回',
    to_audience: '给 {names}',
    transcribed: '已转写', deepened: '已深读',
    deep_title: '深度解读', deep_sub: '基于转写稿的结构化深读',
    deep_thesis: '核心论点', deep_steps: '方法与步骤', deep_facts: '关键信息',
    deep_takeaway: '可落地的结论', deep_caveats: '局限与保留', deep_related: '与已有收藏的关联',
    raw_title: '转发原文',
    tr_title: '音频转写', tr_local: '本地', tr_min: '{n} 分钟', tr_archived: '已归档 mp3',
    tr_expand: '展开全文（{n} 字）',
    related: '相关收藏', related_sub: '同主题 · 按标签重叠度推荐',
    open_original: '打开原内容 ↗', starred_y: '★ 已收藏', add_star: '☆ 加星',
    rating: '评分', note_ph: '写下你的想法、决定、或者这条为什么值得留着…',
    newer: '← 较新', older: '较旧 →',
    tag_cloud: '标签云', tag_meta: '{n} 个标签 · 点选筛选',
    stat_saved: '条收藏', stat_span: '天跨度', stat_actionable: '可行动',
    stat_topics: '个主题', stat_sources: '个来源',
    dp_title: '深读工程', dp_sub: '听一遍 → 读一遍的 AI 管线',
    dp_tr: '已转写', dp_deep: '已深读', dp_chars: '转写字数', dp_cov: '深读覆盖',
    dp_desc: '音频本地转写 → 逐条结构化深读（论点/步骤/事实/结论），数据不出机器。',
    rhythm: '收藏节奏', by_month: '按月收藏量',
    attn: '注意力分布', attn_sub: '一级分类占比',
    when: '什么时候在收藏', when_sub: '星期 × 小时',
    vt: '价值类型', vt_sub: '你存下来的多半是哪一类',
    src: '来源构成', src_sub: '内容主要从哪来',
    todo_title: '看了还没做', todo_sub: '标记了「可做」但还没读完', todo_done: '全部消化完了',
    donut_center: '条收藏', donut_aria: '分类占比', heat_aria: '收藏时间热力图',
    chart_count: '{n} 条', wan: ' 万',
    days_short: ['日', '一', '二', '三', '四', '五', '六'],
    lang_label: 'EN',
  },
  en: {
    nav_flow: 'Timeline', nav_topic: 'Topics', nav_insight: 'Insights',
    view_poster: 'Posters', view_list: 'List',
    clear: 'Clear ✕', actionable: 'Action', starred: 'Starred',
    unread: 'Unread', reading: 'Reading', done: 'Done', archived: 'Archived',
    sort_time: 'Latest', sort_rating: 'Rating', sort_category: 'Topic',
    tip_actionable: 'Show actionable items only', tip_theme: 'Theme: system / light / dark',
    tip_lang: 'Switch language',
    hero_t1: 'Turn scattered saves', hero_t2: 'into a searchable, re-readable collection',
    hero_sub: 'Casual saves from WeChat Channels — organized by topic, understood in depth, ready whenever you come back.',
    search_ph: 'Search titles, summaries, key points…', search_aria: 'Search collection',
    sec_flow: 'Saved in the last {n} days', sec_topic: 'My topics', sec_insight: 'Attention insights',
    unit_items: 'items', unit_cats: 'categories',
    loading: 'Opening your collection…', not_found: 'Item not found',
    footer_stats: '{total} items · spanning {days} days', footer_local: 'Local-first · data stays on your machine',
    btn_refresh: 'Refresh', app_updated: 'New version ready — refresh to apply', data_updated: 'Collection data updated — refresh to see new content',
    badge_actionable: 'DO', badge_deep: 'DEEP', starred_aria: 'Starred',
    empty_title: 'Nothing here yet', empty_hint: 'Try different filters, or save a few more items.',
    back: '← Back',
    to_audience: 'For {names}',
    transcribed: 'Transcribed', deepened: 'Deep-read',
    deep_title: 'Deep Read', deep_sub: 'Structured analysis from the transcript',
    deep_thesis: 'Thesis', deep_steps: 'Method & Steps', deep_facts: 'Key Facts',
    deep_takeaway: 'Takeaway', deep_caveats: 'Caveats', deep_related: 'Connections',
    raw_title: 'Original Message',
    tr_title: 'Audio Transcript', tr_local: 'Local', tr_min: '{n} min', tr_archived: 'mp3 archived',
    tr_expand: 'Show full text ({n} chars)',
    related: 'Related', related_sub: 'Same topic · ranked by tag overlap',
    open_original: 'Open original ↗', starred_y: '★ Starred', add_star: '☆ Star',
    rating: 'Rating', note_ph: 'Write your thoughts, decisions, or why this is worth keeping…',
    newer: '← Newer', older: 'Older →',
    tag_cloud: 'Tag Cloud', tag_meta: '{n} tags · tap to filter',
    stat_saved: 'items saved', stat_span: 'days span', stat_actionable: 'actionable',
    stat_topics: 'topics', stat_sources: 'sources',
    dp_title: 'Deep-Read Pipeline', dp_sub: 'AI pipeline: listen once → read once',
    dp_tr: 'transcribed', dp_deep: 'deep-read', dp_chars: 'chars', dp_cov: 'coverage',
    dp_desc: 'Audio transcribed locally → structured deep-read per item (thesis/steps/facts/takeaway). Data never leaves the machine.',
    rhythm: 'Saving Rhythm', by_month: 'Saves by month',
    attn: 'Attention Split', attn_sub: 'Share by category',
    when: 'When You Save', when_sub: 'Weekday × hour',
    vt: 'Value Types', vt_sub: 'What you tend to keep',
    src: 'Sources', src_sub: 'Where content comes from',
    todo_title: 'Saved, Not Done', todo_sub: 'Marked actionable but not finished', todo_done: 'All done',
    donut_center: 'items', donut_aria: 'Share by category', heat_aria: 'Saving time heatmap',
    chart_count: '{n} items', wan: '0.0k',
    days_short: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    lang_label: '中',
  },
};

/** 翻译：t('key') 或 t('key', { n: 5 })；缺 key 时回退中文再回退 key 本身 */
export function t(key, params) {
  let s = (DICT[lang] && DICT[lang][key]);
  if (s == null) s = DICT.zh[key];
  if (s == null) return key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** 组件用：语言变化时触发重渲染 */
export function useT() {
  useLang();
  return t;
}

/* 模块加载即同步 <html lang>（默认跟随系统语言） */
if (typeof document !== 'undefined') {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
}
