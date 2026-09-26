// 分类体系：一级分类受控（防止标签爆炸），二级与标签自由但会做同义归并提示。
export const DEFAULT_TAXONOMY = {
  version: 1,
  categories: [
    { id: 'ai', name: 'AI 与编程', color: '#2F4858' },
    { id: 'media', name: '自媒体与内容', color: '#B07C3E' },
    { id: 'music', name: '音乐制作', color: '#5B4B6E' },
    { id: 'parenting', name: '育儿与家庭', color: '#6B7248' },
    { id: 'health', name: '健康养生', color: '#2F6F6B' },
    { id: 'mac', name: '效率与 Mac', color: '#35496B' },
    { id: 'life', name: '生活方式', color: '#C2410C' },
    { id: 'business', name: '商业与认知', color: '#8A3B5C' },
    { id: 'english', name: '英语学习', color: '#7A5C3E' },
    { id: 'other', name: '其他待归类', color: '#56534E' },
  ],
  valueTypes: [
    { id: 'tutorial', name: '教程方法' },
    { id: 'insight', name: '认知观点' },
    { id: 'tool', name: '工具资源' },
    { id: 'inspiration', name: '灵感素材' },
    { id: 'news', name: '资讯动态' },
    { id: 'life', name: '生活日常' },
    { id: 'fun', name: '消遣娱乐' },
  ],
  audiences: [
    { id: 'self', name: '我自己' },
    { id: 'family', name: '家人' },
    { id: 'kids', name: '孩子' },
    { id: 'parents', name: '父母' },
    { id: 'work', name: '工作' },
  ],
};

export function loadTaxonomy(dirTaxonomy) {
  const tax = structuredClone(DEFAULT_TAXONOMY);
  if (!dirTaxonomy) return tax;
  // 用户自定义项按 id 覆盖/追加；空数组视为未设置，保留默认
  if (Array.isArray(dirTaxonomy.categories) && dirTaxonomy.categories.length) {
    const map = new Map(tax.categories.map((c) => [c.id, c]));
    for (const c of dirTaxonomy.categories) map.set(c.id, c);
    tax.categories = [...map.values()];
  }
  if (Array.isArray(dirTaxonomy.valueTypes) && dirTaxonomy.valueTypes.length) tax.valueTypes = dirTaxonomy.valueTypes;
  if (Array.isArray(dirTaxonomy.audiences) && dirTaxonomy.audiences.length) tax.audiences = dirTaxonomy.audiences;
  return tax;
}

export function categoryById(tax, id) {
  return tax.categories.find((c) => c.id === id) || tax.categories.find((c) => c.id === 'other');
}
