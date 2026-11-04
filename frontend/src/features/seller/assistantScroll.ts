export interface AssistantScrollMetrics {
  viewportHeight: number;
  scrollHeight: number;
  newestTop: number;
  newestHeight: number;
}

const FEED_INSET = 12;

/**
 * Keeps the latest message in view. A message taller than the feed is anchored
 * at its first line so the seller reads it from the start instead of its tail.
 */
export function assistantScrollTarget({
  viewportHeight, scrollHeight, newestTop, newestHeight,
}: AssistantScrollMetrics): number {
  const maxTop = Math.max(scrollHeight - viewportHeight, 0);
  const visibleHeight = Math.max(viewportHeight - FEED_INSET * 2, 0);
  if (newestHeight > visibleHeight) {
    return Math.min(Math.max(newestTop - FEED_INSET, 0), maxTop);
  }
  return maxTop;
}
