/** Submit on a plain Enter only; allow Shift+Enter and IME composition.
 * Leave standard textarea behaviour intact for all other shortcuts.
 */
export type ChatKey = {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
  repeat?: boolean;
};
export function shouldSendChatOnKey(key: ChatKey): boolean {
  return key.key === 'Enter' && !key.shiftKey && !key.ctrlKey &&
    !key.altKey && !key.metaKey && !key.isComposing && !key.repeat;
}
