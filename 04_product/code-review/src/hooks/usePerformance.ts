import { useEffect, useCallback, useRef } from 'react';
import { PerformanceMonitor } from '@/lib/performance';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  interactionTime: number;
  cacheHitRate: number;
}

export function usePerformance(componentName: string) {
  const mountTimeRef = useRef<number>(0);
  const metricsRef = useRef<Partial<PerformanceMetrics>>({});

  // Component mount tracking
  useEffect(() => {
    mountTimeRef.current = performance.now();
    PerformanceMonitor.mark(`${componentName}-mount-start`);

    return () => {
      const mountTime = performance.now() - mountTimeRef.current;
      PerformanceMonitor.mark(`${componentName}-mount-end`);
      PerformanceMonitor.measure(
        `${componentName}-mount-duration`,
        `${componentName}-mount-start`,
        `${componentName}-mount-end`
      );

      // 開発環境でのパフォーマンスログ
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${componentName} mount took ${mountTime.toFixed(2)}ms`);
      }
    };
  }, [componentName]);

  // Performance measurement helper
  const measurePerformance = useCallback((action: string, fn: () => void | Promise<void>) => {
    const startMark = `${componentName}-${action}-start`;
    const endMark = `${componentName}-${action}-end`;
    const measureName = `${componentName}-${action}-duration`;

    PerformanceMonitor.mark(startMark);
    
    const result = fn();
    
    if (result instanceof Promise) {
      return result.then(() => {
        PerformanceMonitor.mark(endMark);
        PerformanceMonitor.measure(measureName, startMark, endMark);
      });
    } else {
      PerformanceMonitor.mark(endMark);
      PerformanceMonitor.measure(measureName, startMark, endMark);
    }
  }, [componentName]);

  // Track user interactions
  const trackInteraction = useCallback((interactionType: string) => {
    PerformanceMonitor.mark(`${componentName}-interaction-${interactionType}`);
  }, [componentName]);

  // Get performance metrics
  const getMetrics = useCallback((): Partial<PerformanceMetrics> => {
    return metricsRef.current;
  }, []);

  // Report performance data (for monitoring)
  const reportPerformance = useCallback((customMetrics?: Record<string, number>) => {
    if (typeof window === 'undefined') return;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintEntries = performance.getEntriesByType('paint');

    const metrics = {
      component: componentName,
      loadTime: navigation?.loadEventEnd - navigation?.loadEventStart || 0,
      domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart || 0,
      firstPaint: paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
      ...customMetrics,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      connection: (navigator as any).connection?.effectiveType || 'unknown',
    };

    // 開発環境ではコンソールに出力
    if (process.env.NODE_ENV === 'development') {
      console.table(metrics);
    }

    // プロダクション環境では分析サービスに送信（実装は省略）
    if (process.env.NODE_ENV === 'production') {
      // analytics.track('performance', metrics);
    }
  }, [componentName]);

  return {
    measurePerformance,
    trackInteraction,
    getMetrics,
    reportPerformance
  };
}

// Web Vitals tracking hook
export function useWebVitals() {
  useEffect(() => {
    // Dynamic import for web-vitals (optional dependency)
    const loadWebVitals = async () => {
      try {
        const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');
        
        getCLS(console.log);
        getFID(console.log);
        getFCP(console.log);
        getLCP(console.log);
        getTTFB(console.log);
      } catch (error) {
        console.warn('Web Vitals not available:', error);
      }
    };

    if (process.env.NODE_ENV === 'development') {
      loadWebVitals();
    }
  }, []);
}

// Resource loading performance hook
export function useResourcePerformance() {
  const trackResourceLoad = useCallback((resourceUrl: string, startTime: number) => {
    const endTime = performance.now();
    const loadTime = endTime - startTime;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Resource] ${resourceUrl} loaded in ${loadTime.toFixed(2)}ms`);
    }

    // Track slow loading resources
    if (loadTime > 1000) {
      console.warn(`[Performance] Slow resource detected: ${resourceUrl} (${loadTime.toFixed(2)}ms)`);
    }
  }, []);

  const preloadResource = useCallback((url: string, type: 'script' | 'style' | 'image' = 'script') => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = type;
    
    if (type === 'script') {
      link.crossOrigin = 'anonymous';
    }
    
    document.head.appendChild(link);
  }, []);

  return {
    trackResourceLoad,
    preloadResource
  };
}

// Memory usage monitoring hook
export function useMemoryMonitor() {
  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryInfo = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('[Memory]', memoryInfo);
      }

      // Warning for high memory usage
      if (memoryInfo.usagePercentage > 80) {
        console.warn('[Performance] High memory usage detected:', memoryInfo);
      }

      return memoryInfo;
    }
    return null;
  }, []);

  useEffect(() => {
    // Check memory usage periodically in development
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(checkMemoryUsage, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [checkMemoryUsage]);

  return { checkMemoryUsage };
}