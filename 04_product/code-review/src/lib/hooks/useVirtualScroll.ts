import { useCallback, useEffect, useRef, useState } from 'react';
import { getVisibleRange } from '@/lib/performance';

interface UseVirtualScrollOptions {
  totalItems: number;
  itemHeight: number;
  enabled?: boolean;
  buffer?: number;
}

interface VirtualScrollState {
  containerRef: React.RefObject<HTMLDivElement>;
  visibleRange: { start: number; end: number; visible: number } | null;
  scrollToLine: ((lineIndex: number) => void) | null;
  containerHeight: number;
}

export function useVirtualScroll({
  totalItems,
  itemHeight,
  enabled = true,
  buffer = 5
}: UseVirtualScrollOptions): VirtualScrollState {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number; visible: number } | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  // スクロールイベントハンドラー
  const handleScroll = useCallback(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const range = getVisibleRange(containerHeight, itemHeight, scrollTop, totalItems, buffer);
    
    setVisibleRange(range);
  }, [enabled, containerHeight, itemHeight, totalItems, buffer]);

  // リサイズオブザーバー
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        setContainerHeight(height);
        
        // 初期表示範囲を設定
        if (height > 0) {
          const range = getVisibleRange(height, itemHeight, 0, totalItems, buffer);
          setVisibleRange(range);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [enabled, itemHeight, totalItems, buffer]);

  // スクロールイベントリスナー
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    let ticking = false;

    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', throttledScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', throttledScroll);
    };
  }, [enabled, handleScroll]);

  // 指定行にスクロール
  const scrollToLine = useCallback((lineIndex: number) => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const targetScrollTop = Math.max(0, lineIndex * itemHeight - containerHeight / 2);
    
    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });
  }, [enabled, itemHeight, containerHeight]);

  return {
    containerRef,
    visibleRange: enabled ? visibleRange : null,
    scrollToLine: enabled ? scrollToLine : null,
    containerHeight
  };
}