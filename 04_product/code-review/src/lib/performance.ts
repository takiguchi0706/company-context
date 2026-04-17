/**
 * パフォーマンス最適化ユーティリティ
 */

// グローバルキャッシュ
export const globalCache = new Map<string, any>();

// キャッシュクリーンアップ（メモリ制限）
const MAX_CACHE_SIZE = 100;
let cacheCleanupTimer: NodeJS.Timeout | null = null;

function cleanupCache() {
  if (globalCache.size > MAX_CACHE_SIZE) {
    const keys = Array.from(globalCache.keys());
    const keysToDelete = keys.slice(0, keys.length - MAX_CACHE_SIZE + 20);
    keysToDelete.forEach(key => globalCache.delete(key));
  }
}

// デバウンス関数
export function useDebounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// コンポーネントレベルキャッシュ
export function withCache<T>(
  key: string,
  generator: () => T,
  ttl: number = 300000 // 5分
): T {
  const cacheKey = `cache_${key}`;
  const cached = globalCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.value;
  }
  
  const value = generator();
  globalCache.set(cacheKey, {
    value,
    timestamp: Date.now()
  });
  
  // 定期クリーンアップ
  if (cacheCleanupTimer) clearTimeout(cacheCleanupTimer);
  cacheCleanupTimer = setTimeout(cleanupCache, 30000);
  
  return value;
}

// 遅延読み込み
export function createLazyComponent<P = {}>(
  importFunc: () => Promise<{ default: React.ComponentType<P> }>
) {
  return React.lazy(importFunc);
}

// プリロード
export function preloadRoute(href: string) {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  }
}

// Virtual Scrolling用ヘルパー
export function getVisibleRange(
  containerHeight: number,
  itemHeight: number,
  scrollTop: number,
  totalItems: number,
  buffer: number = 5
) {
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const visible = Math.ceil(containerHeight / itemHeight);
  const end = Math.min(totalItems, start + visible + buffer * 2);
  
  return { start, end, visible };
}