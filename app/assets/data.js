/* 数据层：读取 build 产出的 window.SUPERMARK_DATA，并建立索引 */
window.SM = window.SM || {};
(function () {
  const D = window.SUPERMARK_DATA || { version: 1, taxonomy: { categories: [] }, marks: [], stats: {} };
  SM.data = D;
  SM.marks = D.marks || [];
  SM.tax = D.taxonomy || { categories: [] };
  SM.stats = D.stats || {};

  SM.byId = new Map(SM.marks.map((m) => [m.id, m]));
  const catMap = new Map(SM.tax.categories.map((c) => [c.id, c]));
  const valMap = new Map((SM.tax.valueTypes || []).map((v) => [v.id, v]));
  const audMap = new Map((SM.tax.audiences || []).map((v) => [v.id, v]));

  SM.catColor = (id) => (catMap.get(id) || {}).color || '#56534E';
  SM.catName = (id) => (catMap.get(id) || {}).name || id;
  SM.valName = (id) => (valMap.get(id) || {}).name || id;
  SM.audName = (id) => (audMap.get(id) || {}).name || id;

  SM.PLAT_LABEL = {
    channels: '视频号', 'wechat-mp': '公众号', xiaohongshu: '小红书', bilibili: 'B站',
    youtube: 'YouTube', github: 'GitHub', wechat: '微信', zhihu: '知乎', douyin: '抖音',
    twitter: 'X', web: '网页', text: '文字',
  };
  SM.platLabel = (p) => SM.PLAT_LABEL[p] || p;

  const p2 = (n) => String(n).padStart(2, '0');
  SM.fmtDate = (iso) => {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`;
  };
  SM.fmtShort = (iso) => {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    return `${p2(d.getMonth() + 1)}/${p2(d.getDate())}`;
  };
  SM.fmtTime = (iso) => {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  };

  // 检索文本：标题/摘要/要点/原文/标签/分类/行动提示
  SM.marks.forEach((m) => {
    m._q = [m.title, m.summary, m.rawText, (m.keyPoints || []).join(' '),
      (m.tags || []).join(' '), (m.rawTags || []).join(' '), m.categoryName, m.subCategory, m.actionHint]
      .filter(Boolean).join(' ').toLowerCase();
  });
})();
