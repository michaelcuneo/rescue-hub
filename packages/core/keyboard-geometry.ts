/** Screen coordinates (not ScrollView content coordinates) are used by both
 * TextInput.measureInWindow and Keyboard event.endCoordinates.screenY.
 */
export type KeyboardVisibilityBounds = {
  fieldTop: number;
  fieldBottom: number;
  viewportTop: number;
  viewportBottom: number;
  keyboardTop?: number | null;
  clearance?: number;
};

export function keyboardOverlap(viewportBottom: number, keyboardTop?: number | null): number {
  if (!Number.isFinite(viewportBottom) || keyboardTop == null || !Number.isFinite(keyboardTop)) return 0;
  return Math.max(0, viewportBottom - keyboardTop);
}

/** Positive means scroll content UP; negative means scroll content DOWN.
 * This is calculated *after* the keyboard and surrounding views move.
 * Taller-than-viewport multiline fields align their top, rather than
 * endlessly trying to display the entire field at once.
 */
export function keyboardScrollDelta(bounds: KeyboardVisibilityBounds): number {
  const { fieldTop, fieldBottom, viewportTop, viewportBottom } = bounds;
  if (![fieldTop, fieldBottom, viewportTop, viewportBottom].every(Number.isFinite)
      || fieldBottom < fieldTop || viewportBottom <= viewportTop) return 0;
  const margin = Math.max(0, bounds.clearance ?? 24);
  const top = viewportTop + margin;
  const bottom = Math.min(viewportBottom, bounds.keyboardTop ?? Infinity) - margin;
  if (bottom <= top) return fieldTop - viewportTop;
  if (fieldBottom - fieldTop > bottom - top) return fieldTop - top;
  if (fieldBottom > bottom) return fieldBottom - bottom;
  if (fieldTop < top) return fieldTop - top;
  return 0;
}
