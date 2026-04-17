import { useCallback, useRef, useEffect, useMemo } from 'react';

/**
 * パフォーマンス最適化ユーティリティ
 */

// グローバルキャッシュ（LRU実装）
class LRUCache<T> {
  private cache = new Map<string, { value: T; timestamp: number; accessTime: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 100, ttl = 300000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    // TTL チェック
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // アクセス時間を更新
    item.accessTime = Date.now();
    return item.value;
  }

  set(key: string, value: T): void {
    const now = Date.now();
    
    // 既存アイテムの場合は更新
    if (this.cache.has(key)) {
      this.cache.set(key, { value, timestamp: now, accessTime: now });
      return;
    }

    // サイズ制限チェック
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, { value, timestamp: now, accessTime: now });
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, item] of this.cache) {
      if (item.accessTime < oldestTime) {
        oldestTime = item.accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const globalCache = new LRUCache(200, 600000); // 10分TTL

// リクエストデデュープ（同じリクエストを重複実行しない）
const pendingRequests = new Map<string, Promise<any>>();

export function dedupeRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }

  const promise = requestFn()
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, promise);
  return promise;
}

// デバウンス関数（React用に最適化）
export function useDebounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const funcRef = useRef(func);

  // 最新の関数を保持
  funcRef.current = func;

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      funcRef.current(...args);
    }, delay);
  }, [delay]);
}

// スロットル関数
export function useThrottle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef<number>(0);
  const funcRef = useRef(func);

  funcRef.current = func;

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      funcRef.current(...args);
    }
  }, [delay]);
}

// メモ化フック（useMemoの強化版）
export function useDeepMemo<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  const ref = useRef<{ deps: React.DependencyList; value: T }>();

  if (!ref.current || !shallowEqual(ref.current.deps, deps)) {
    ref.current = { deps, value: factory() };
  }

  return ref.current.value;
}

function shallowEqual(a: React.DependencyList, b: React.DependencyList): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// コンポーネントレベルキャッシュ
export function withCache<T>(
  key: string,
  generator: () => T,
  ttl: number = 300000
): T {
  const cached = globalCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const value = generator();
  globalCache.set(key, value);
  return value;
}

// 遅延読み込み（動的インポート）
export const createLazyComponent = <P = {}>(
  importFunc: () => Promise<{ default: React.ComponentType<P> }>
) => {
  return React.lazy(importFunc);
};

// プリロード関数群
export function preloadRoute(href: string): void {
  if (typeof window === 'undefined') return;

  // Next.js のルーターでプリフェッチ
  if ('__NEXT_ROUTER__' in window) {
    // @ts-ignore
    window.__NEXT_ROUTER__.prefetch(href);
  }

  // 手動プリフェッチ
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

export function preloadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.onload = () => resolve();
    script.onerror = reject;
    script.src = src;
    document.head.appendChild(script);
  });
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

// パフォーマンス計測
export class PerformanceMonitor {
  private static marks = new Map<string, number>();

  static mark(name: string): void {
    this.marks.set(name, performance.now());
    if (typeof performance.mark === 'function') {
      performance.mark(name);
    }
  }

  static measure(name: string, startMark: string, endMark?: string): number {
    const startTime = this.marks.get(startMark);
    if (!startTime) return 0;

    const endTime = endMark ? this.marks.get(endMark) : performance.now();
    if (!endTime) return 0;

    const duration = endTime - startTime;

    if (typeof performance.measure === 'function') {
      try {
        performance.measure(name, startMark, endMark);
      } catch (e) {
        console.warn('Performance measure failed:', e);
      }
    }

    return duration;
  }

  static clearMarks(): void {
    this.marks.clear();
    if (typeof performance.clearMarks === 'function') {
      performance.clearMarks();
    }
  }
}

// レスポンス時間の最適化
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const callbackRef = useRef<T>(callback);

  // 最新のコールバックを保持
  useEffect(() => {
    callbackRef.current = callback;
  });

  // メモ化されたコールバック
  return useCallback(
    ((...args: any[]) => {
      return callbackRef.current(...args);
    }) as T,
    deps
  );
}

// バッチ処理
export class BatchProcessor<T> {
  private queue: T[] = [];
  private processor: (items: T[]) => void;
  private delay: number;
  private timeoutId?: NodeJS.Timeout;

  constructor(processor: (items: T[]) => void, delay = 16) {
    this.processor = processor;
    this.delay = delay;
  }

  add(item: T): void {
    this.queue.push(item);
    this.scheduleProcess();
  }

  private scheduleProcess(): void {
    if (this.timeoutId) return;

    this.timeoutId = setTimeout(() => {
      if (this.queue.length > 0) {
        const items = [...this.queue];
        this.queue.length = 0;
        this.processor(items);
      }
      this.timeoutId = undefined;
    }, this.delay);
  }

  flush(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    if (this.queue.length > 0) {
      const items = [...this.queue];
      this.queue.length = 0;
      this.processor(items);
    }
  }
}