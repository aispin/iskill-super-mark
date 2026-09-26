// URL 域名 → 来源平台。只做本地识别，不联网抓取正文。

const RULES = [
  { test: /weixin\.qq\.com\/sph\//i, platform: 'channels', label: '视频号' },
  { test: /^https?:\/\/mp\.weixin\.qq\.com/i, platform: 'wechat-mp', label: '公众号' },
  { test: /(xiaohongshu\.com|xhslink\.com)/i, platform: 'xiaohongshu', label: '小红书' },
  { test: /(bilibili\.com|b23\.tv)/i, platform: 'bilibili', label: 'B站' },
  { test: /(youtube\.com|youtu\.be)/i, platform: 'youtube', label: 'YouTube' },
  { test: /github\.com/i, platform: 'github', label: 'GitHub' },
  { test: /(weixin\.qq\.com)/i, platform: 'wechat', label: '微信' },
  { test: /(zhihu\.com)/i, platform: 'zhihu', label: '知乎' },
  { test: /(douyin\.com)/i, platform: 'douyin', label: '抖音' },
  { test: /(x\.com|twitter\.com)/i, platform: 'twitter', label: 'X' },
];

export const PLATFORM_LABELS = Object.fromEntries(RULES.map((r) => [r.platform, r.label]));

/** 从 URL 推断平台；无 URL 返回 text */
export function detectPlatform(url) {
  if (!url) return 'text';
  for (const r of RULES) if (r.test.test(url)) return r.platform;
  return 'web';
}

export function platformLabel(platform) {
  return PLATFORM_LABELS[platform] || (platform === 'web' ? '网页' : platform === 'text' ? '文字' : platform);
}

/** 提取 URL（取第一条） */
export function extractUrl(text) {
  const m = String(text || '').match(/https?:\/\/[^\s"'）)】]+/);
  return m ? m[0] : '';
}

/**
 * 内容指纹：用于去重。
 * 视频号/小红书等短链取末段 ID；普通 URL 去协议与末尾斜杠；无 URL 用正文前 80 字。
 */
export function fingerprint({ url = '', rawText = '', sentAt = '' }) {
  if (url) {
    const tail = url.replace(/\/+$/, '').split('/').pop();
    if (/^[A-Za-z0-9_-]{6,}$/.test(tail)) return tail;
    return url.replace(/^https?:\/\//, '').replace(/\/+$/, '').slice(-48);
  }
  const base = `${rawText.slice(0, 80)}|${String(sentAt).slice(0, 10)}`;
  // 简易 32 位散列，足够做本地去重
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (Math.imul(31, h) + base.charCodeAt(i)) | 0;
  return `t${(h >>> 0).toString(36)}`;
}
