// Performance optimization utilities

import { useState, useCallback, useMemo } from 'react';

/**
 * デバウンス処理用のカスタムフック
 * 連続したユーザー入力を制御してパフォーマンスを向上
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      const newTimeoutId = setTimeout(() => {
        callback(...args);
      }, delay);
      
      setTimeoutId(newTimeoutId);
    }) as T,
    [callback, delay, timeoutId]
  );
}

/**
 * 重いコード処理をWeb Worker風に分割実行
 * UIブロッキングを防ぐ
 */
export function processInChunks<T>(
  items: T[],
  processor: (item: T) => void,
  chunkSize: number = 100
): Promise<void> {
  return new Promise((resolve) => {
    let index = 0;
    
    function processChunk() {
      const endIndex = Math.min(index + chunkSize, items.length);
      
      for (let i = index; i < endIndex; i++) {
        processor(items[i]);
      }
      
      index = endIndex;
      
      if (index < items.length) {
        // 次のチャンクを非同期で処理
        setTimeout(processChunk, 0);
      } else {
        resolve();
      }
    }
    
    processChunk();
  });
}

/**
 * コード行の仮想化処理
 * 大きなファイルでも高速表示
 */
export function useVirtualizedLines(
  content: string,
  containerHeight: number,
  lineHeight: number = 20
) {
  const lines = useMemo(() => content.split('\n'), [content]);
  
  const visibleCount = Math.ceil(containerHeight / lineHeight) + 5; // バッファ追加
  
  const getVisibleLines = useCallback((scrollTop: number) => {
    const startIndex = Math.floor(scrollTop / lineHeight);
    const endIndex = Math.min(startIndex + visibleCount, lines.length);
    
    return {
      startIndex,
      endIndex,
      visibleLines: lines.slice(startIndex, endIndex),
      totalHeight: lines.length * lineHeight,
    };
  }, [lines, lineHeight, visibleCount]);
  
  return { getVisibleLines, totalLines: lines.length };
}

/**
 * LRUキャッシュ実装
 * API結果やレンダリング結果をキャッシュ
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // アクセスされた項目を最新に移動
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 最も古い項目を削除
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * グローバルキャッシュインスタンス
 */
export const globalCache = new LRUCache<string, any>(100);