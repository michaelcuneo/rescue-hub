export type ChatMentionKind = 'person' | 'animal' | 'rescue';
export type ChatMention = {
  kind: ChatMentionKind;
  id: string;
  label: string;
  handle: string;
  rescueId?: string;
};
export type MentionSegment = { text: string; mention?: ChatMention };

const MENTION_PATTERN = /(?:^|\s)@([a-z0-9_-]{0,60})$/i;

/** Deterministic, readable handles. UUIDs, not handles, identify records. */
export function mentionHandle(name: string): string {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 60);
}

export function currentMentionQuery(text: string): string | null {
  return MENTION_PATTERN.exec(text)?.[1] ?? null;
}

/** Replaces only a trailing, actively typed @search with a selected identity. */
export function insertChatMention(text: string, mention: ChatMention): string {
  const match = MENTION_PATTERN.exec(text);
  if (!match) return text;
  const start = text.length - (match[1] ?? '').length - 1;
  const next = text.slice(0, start) + '@' + mention.handle + ' ';
  return next.length <= 2000 ? next : text;
}

export function usableChatMentions(text: string, input: ChatMention[]): ChatMention[] {
  const valid = new Map<string, ChatMention>();
  for (const mention of input.slice(0, 10)) {
    if (!mention || !['person', 'animal', 'rescue'].includes(mention.kind) ||
      typeof mention.id !== 'string' ||
      !/^[a-f\d-]{36}$/i.test(mention.id) ||
      typeof mention.handle !== 'string' ||
      !/^[a-z0-9][a-z0-9-]{0,59}$/.test(mention.handle) ||
      typeof mention.label !== 'string' || mention.label.length > 90) continue;
    const boundary = new RegExp('(^|\\s)@' + mention.handle + '(?=$|[\\s,.;:!?])', 'i');
    if (boundary.test(text)) valid.set(mention.kind + ':' + mention.id, mention);
  }
  return [...valid.values()];
}

/** Do not treat arbitrary @text as a link: only server-resolved references. */
export function splitChatMentions(text: string, mentions: ChatMention[] = []): MentionSegment[] {
  const active = usableChatMentions(text, mentions);
  if (!active.length) return [{ text }];
  const occurrences: Array<{ start: number; end: number; mention: ChatMention }> = [];
  for (const mention of active) {
    const token = '@' + mention.handle;
    let from = 0;
    while (from < text.length) {
      const pos = text.toLowerCase().indexOf(token.toLowerCase(), from);
      if (pos < 0) break;
      const before = pos === 0 ? ' ' : (text[pos - 1] ?? ' ');
      const after = text[pos + token.length] ?? ' ';
      if (/\s/.test(before) && /[\s,.;:!?]/.test(after)) {
        occurrences.push({ start: pos, end: pos + token.length, mention });
      }
      from = pos + token.length;
    }
  }
  occurrences.sort((a, b) => a.start - b.start || b.end - a.end);
  const segments: MentionSegment[] = [];
  let cursor = 0;
  for (const item of occurrences) {
    if (item.start < cursor) continue;
    if (item.start > cursor) segments.push({ text: text.slice(cursor, item.start) });
    segments.push({ text: text.slice(item.start, item.end), mention: item.mention });
    cursor = item.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
