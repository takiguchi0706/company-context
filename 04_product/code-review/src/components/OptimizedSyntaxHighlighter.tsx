"use client";

import { memo, useState, useEffect, useMemo, useCallback } from "react";
import { globalCache, PerformanceMonitor } from "@/lib/performance";

interface OptimizedSyntaxHighlighterProps {
  code: string;
  language: string;
  highlightLine?: number | null;
  className?: string;
  maxLines?: number; // Virtual Scrolling用
}

// 軽量版のシンタックスハイライター（初期表示用）
const LightSyntaxHighlighter = memo(({ code, highlightLine }: {
  code: string;
  highlightLine?: number | null;
}) => {
  const lines = useMemo(() => code.split('\n'), [code]);
  
  return (
    <div className="font-mono text-sm">
      {lines.map((line, i) => (
        <div
          key={i}
          className={`px-4 py-0.5 hover:bg-gray-50 ${
            highlightLine === i + 1 
              ? 'bg-yellow-100 border-l-4 border-yellow-500' 
              : ''
          }`}
          style={{ 
            minHeight: '20px',
            backgroundColor: highlightLine === i + 1 ? '#fef3c7' : undefined
          }}
        >
          <span className="text-gray-400 mr-4 select-none w-8 inline-block text-right">
            {i + 1}
          </span>
          <span>{line || ' '}</span>
        </div>
      ))}
    </div>
  );
});
LightSyntaxHighlighter.displayName = 'LightSyntaxHighlighter';

// 重いライブラリの遅延読み込み
let ReactSyntaxHighlighter: any = null;
let prismStyles: any = null;

const loadSyntaxHighlighter = async () => {
  PerformanceMonitor.mark('syntax-highlighter-import-start');
  
  const cacheKey = 'syntax-highlighter-module';
  const cached = globalCache.get(cacheKey);
  if (cached) return cached;

  try {
    const [highlighterModule, stylesModule] = await Promise.all([
      import('react-syntax-highlighter').then(mod => mod.Prism),
      import('react-syntax-highlighter/dist/esm/styles/prism/vs').then(mod => mod.default)
    ]);

    ReactSyntaxHighlighter = highlighterModule;
    prismStyles = stylesModule;

    const result = { ReactSyntaxHighlighter, prismStyles };
    globalCache.set(cacheKey, result);
    
    PerformanceMonitor.measure('syntax-highlighter-import-complete', 'syntax-highlighter-import-start');
    return result;
    
  } catch (error) {
    console.error('Failed to load syntax highlighter:', error);
    return null;
  }
};

export const OptimizedSyntaxHighlighter = memo<OptimizedSyntaxHighlighterProps>(({
  code,
  language,
  highlightLine,
  className,
  maxLines = 1000
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Intersection Observer で可視領域に入ったら重いライブラリを読み込み
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // 少し手前で読み込み開始
    );

    const element = document.getElementById('syntax-highlighter-container');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // 可視領域に入ったらライブラリを読み込み
  useEffect(() => {
    if (isVisible && !isLoaded) {
      loadSyntaxHighlighter().then((result) => {
        if (result) {
          setIsLoaded(true);
        }
      });
    }
  }, [isVisible, isLoaded]);

  // ハイライト行への自動スクロール（デバウンス付き）
  const scrollToHighlight = useCallback(() => {
    if (highlightLine) {
      const element = document.querySelector(`[data-line-number="${highlightLine}"]`);
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }
  }, [highlightLine]);

  useEffect(() => {
    if (highlightLine) {
      const timer = setTimeout(scrollToHighlight, 100);
      return () => clearTimeout(timer);
    }
  }, [highlightLine, scrollToHighlight]);

  // 大きなファイルの場合は Virtual Scrolling を適用
  const shouldUseVirtualScrolling = useMemo(() => {
    return code.split('\n').length > maxLines;
  }, [code, maxLines]);

  if (shouldUseVirtualScrolling) {
    return (
      <VirtualizedCodeViewer
        code={code}
        highlightLine={highlightLine}
        className={className}
      />
    );
  }

  if (!isLoaded) {
    return (
      <div id="syntax-highlighter-container" className={`overflow-auto ${className}`}>
        <LightSyntaxHighlighter 
          code={code} 
          highlightLine={highlightLine}
        />
        {isVisible && (
          <div className="absolute top-4 right-4 text-xs text-gray-500">
            シンタックスハイライトを読み込み中...
          </div>
        )}
      </div>
    );
  }

  if (!ReactSyntaxHighlighter || !prismStyles) {
    return (
      <div className={`overflow-auto ${className}`}>
        <LightSyntaxHighlighter 
          code={code} 
          highlightLine={highlightLine}
        />
      </div>
    );
  }

  // カスタムスタイル（ハイライト行対応）
  const customStyle = useMemo(() => ({
    ...prismStyles,
    padding: '0',
    margin: '0',
    background: 'transparent',
    fontSize: '14px',
    lineHeight: '20px',
  }), []);

  // 行番号付きレンダラー
  const lineProps = useCallback((lineNumber: number) => ({
    style: {
      backgroundColor: highlightLine === lineNumber 
        ? 'rgba(250, 204, 21, 0.2)' 
        : 'transparent',
      borderLeft: highlightLine === lineNumber 
        ? '4px solid rgb(250, 204, 21)' 
        : '4px solid transparent',
      paddingLeft: '12px',
      display: 'block',
      minHeight: '20px',
    },
    'data-line-number': lineNumber,
  }), [highlightLine]);

  return (
    <div className={`overflow-auto ${className}`}>
      <ReactSyntaxHighlighter
        language={language}
        style={customStyle}
        showLineNumbers={true}
        lineNumberStyle={{ 
          minWidth: '40px', 
          paddingRight: '16px',
          color: '#9ca3af',
          textAlign: 'right',
          userSelect: 'none'
        }}
        lineProps={lineProps}
        customStyle={{
          background: 'transparent',
          padding: '16px 0',
        }}
        codeTagProps={{
          style: { fontFamily: 'var(--font-mono)' }
        }}
      >
        {code}
      </ReactSyntaxHighlighter>
    </div>
  );
});

OptimizedSyntaxHighlighter.displayName = 'OptimizedSyntaxHighlighter';

// Virtual Scrolling対応版（大きなファイル用）
const VirtualizedCodeViewer = memo(({ 
  code, 
  highlightLine, 
  className 
}: {
  code: string;
  highlightLine?: number | null;
  className?: string;
}) => {
  const lines = useMemo(() => code.split('\n'), [code]);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const [containerHeight, setContainerHeight] = useState(400);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight } = e.currentTarget;
    const lineHeight = 20;
    const start = Math.max(0, Math.floor(scrollTop / lineHeight) - 10);
    const visible = Math.ceil(clientHeight / lineHeight);
    const end = Math.min(lines.length, start + visible + 20);
    
    setVisibleRange({ start, end });
    setContainerHeight(clientHeight);
  }, [lines.length]);

  const visibleLines = useMemo(() => {
    return lines.slice(visibleRange.start, visibleRange.end);
  }, [lines, visibleRange]);

  const totalHeight = lines.length * 20;
  const offsetY = visibleRange.start * 20;

  return (
    <div 
      className={`overflow-auto font-mono text-sm ${className}`}
      onScroll={handleScroll}
      style={{ height: '100%' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleLines.map((line, i) => {
            const lineNumber = visibleRange.start + i + 1;
            return (
              <div
                key={lineNumber}
                className={`px-4 py-0.5 hover:bg-gray-50 ${
                  highlightLine === lineNumber 
                    ? 'bg-yellow-100 border-l-4 border-yellow-500' 
                    : ''
                }`}
                style={{ 
                  height: '20px',
                  backgroundColor: highlightLine === lineNumber ? '#fef3c7' : undefined
                }}
                data-line-number={lineNumber}
              >
                <span className="text-gray-400 mr-4 select-none w-8 inline-block text-right">
                  {lineNumber}
                </span>
                <span>{line || ' '}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

VirtualizedCodeViewer.displayName = 'VirtualizedCodeViewer';