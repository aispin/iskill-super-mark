// 微信聊天记录解析：把「昵称 MM-DD HH:mm [Channels] 正文 #标签 https://...」切成结构化条目。
import { detectPlatform, extractUrl, fingerprint } from './platform.mjs';

// 记录起始行：昵称 + 时间（可选年份）
const HEAD = /^(.*?)\s+(\d{4}-)?(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(.*)$/;
// 话题标签：#xxx，遇到空白或标点即止（中文标签常见连排）
const TAG = /#([^\s#,，。;；:：!！?？\[\]{}（）()"'、]+)/g;

const pad = (n) => String(n).padStart(2, '0');

/** 单条消息的正文 → 结构体（不含时间，时间由调用方给） */
export function parseBody(body, { sender = '', sentAt = '' } = {}) {
  let text = String(body || '').replace(/\r/g, '');

  // 来源标记：[Channels] 视频号 / [Channel] 频道主页
  let sourceType = 'text';
  const markMatch = text.match(/^\s*\[(Channels?)\]\s*/);
  if (markMatch) {
    sourceType = markMatch[1] === 'Channels' ? 'channels' : 'channel';
    text = text.slice(markMatch[0].length);
  }

  const url = extractUrl(text);
  const tags = [...text.matchAll(TAG)].map((m) => m[1].trim()).filter(Boolean);

  let rawText = text.replace(/https?:\/\/\S+/g, ' ').replace(TAG, ' ');
  rawText = rawText.replace(/\s+/g, ' ').replace(/^[\s,，.。、;；:：!！?？|]+/, '').trim();

  const platform = detectPlatform(url);

  return {
    id: fingerprint({ url, rawText, sentAt }),
    sourceType,
    sourcePlatform: platform,
    sender,
    sentAt,
    url,
    rawText,
    rawTags: [...new Set(tags)],
    dupCount: 1,
  };
}

/**
 * 解析整段聊天记录。
 * @param {string} text 聊天记录全文
 * @param {object} opts { year, tz }
 * @returns {{items: object[], skipped: string[]}}
 */
export function parseChatLog(text, opts = {}) {
  const lines = String(text || '').split('\n');
  const baseYear = opts.year || new Date().getFullYear();
  const items = [];
  const skipped = [];

  let cur = null;   // 当前正在累积的记录 {sender, sentAt, lines[]}
  let year = baseYear;
  let prevMonth = null;

  const flush = () => {
    if (!cur) return;
    const item = parseBody(cur.lines.join('\n').trim(), { sender: cur.sender, sentAt: cur.sentAt });
    // 无链接且无正文（例如只转了个 [Channels] 空壳）直接丢弃，避免垃圾条目入库
    if (item.url || item.rawText) items.push(item);
    else skipped.push(cur.sentAt);
    cur = null;
  };

  for (const line of lines) {
    const m = line.match(HEAD);
    if (m) {
      const [, sender, yearRaw, mo, d, h, mi, , rest] = m;
      let y = yearRaw ? Number(String(yearRaw).replace('-', '')) : year;
      const month = Number(mo);
      // 跨年推断：月份从大跳到小视为跨年（12 → 01）
      if (!yearRaw && prevMonth !== null && month > prevMonth + 6) y -= 1;
      if (!yearRaw && prevMonth !== null && prevMonth > month + 6) y += 1;
      if (!yearRaw) year = y;
      prevMonth = month;

      flush();
      const sentAt = `${y}-${pad(month)}-${pad(Number(d))}T${pad(Number(h))}:${mi}:00`;
      cur = { sender: String(sender || '').trim(), sentAt, lines: [rest || ''] };
    } else if (cur) {
      cur.lines.push(line);
    }
    // 首行之前的内容（导出头部说明）直接忽略
  }
  flush();

  return { items, skipped };
}

/** 解析单个片段（用于 add 命令）：可带或不带「昵称 时间」前缀 */
export function parseSingle(input, opts = {}) {
  const text = String(input || '').trim();
  const firstLine = text.split('\n')[0];
  const m = firstLine.match(HEAD);
  if (m) {
    const [, sender, yearRaw, mo, d, h, mi, , rest] = m;
    const y = yearRaw ? Number(String(yearRaw).replace('-', '')) : opts.year || new Date().getFullYear();
    const sentAt = `${y}-${pad(Number(mo))}-${pad(Number(d))}T${pad(Number(h))}:${mi}:00`;
    const restLines = [rest || '', ...text.split('\n').slice(1)];
    return parseBody(restLines.join('\n').trim(), { sender: String(sender || '').trim(), sentAt });
  }
  const now = new Date();
  const sentAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
  return parseBody(text, { sender: opts.sender || '', sentAt });
}
