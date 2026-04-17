"use client";

import { memo, useMemo, useRef, useEffect, useState, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { withCache, getVisibleRange } from "@/lib/performance";

interface OptimizedSyntaxHighlighterProps {
  code: string;
  language: string;
  highlightLine?: number | null;
  className?: string;
}

// Virtual Scrolling対応のSyntaxHighlighter
export const OptimizedSyntaxHighlighter = memo<OptimizedSyntaxHighlighterProps>(
  ({ code, language, highlightLine, className = "" }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(800);

    const lines = useMemo(() => code.split('\n'), [code]);
    const lineHeight = 24; // 1行の高さ(px)

    // ハイライト行への自動スクロール
    useEffect(() => {
      if (highlightLine && containerRef.current) {
        const targetPosition = (highlightLine - 1) * lineHeight;
        const container = containerRef.current;
        const scrollPosition = Math.max(0, targetPosition - containerHeight / 2);
        
        container.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }, [highlightLine, containerHeight]);

    // コンテナサイズ監視
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const resizeObserver = new ResizeObserver(([entry]) => {
        setContainerHeight(entry.contentRect.height);
      });

      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }, []);

    // スクロールハンドリング
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    }, []);

    // 表示範囲の計算
    const { start, end } = useMemo(() => 
      getVisibleRange(containerHeight, lineHeight, scrollTop, lines.length, 10),
      [containerHeight, scrollTop, lines.length]
    );

    // キャッシュされたスタイル計算
    const customStyle = useMemo(() => withCache(
      `syntax-style-${language}`,
      () => ({
        ...oneDark,
        'pre[class*="language-"]': {
          ...oneDark['pre[class*="language-"]'],
          background: 'var(--surface)',
          fontSize: '14px',
          lineHeight: `${lineHeight}px`,
          margin: 0,
          padding: 0,
        },
        'code[class*="language-"]': {
          ...oneDark['code[class*="language-"]'],
          background: 'transparent',
          fontSize: '14px',
          lineHeight: `${lineHeight}px`,
        },
      })
    ), [language]);

    // 仮想スクロール用の表示コード生成
    const visibleCode = useMemo(() => {
      const visibleLines = lines.slice(start, end);
      return visibleLines.join('\n');
    }, [lines, start, end]);

    // ハイライト行のスタイル
    const lineProps = useCallback((lineNumber: number) => {
      const actualLineNumber = start + lineNumber;
      const isHighlighted = highlightLine === actualLineNumber;
      
      return {
        style: {
          display: 'block',
          backgroundColor: isHighlighted ? 'rgba(250, 204, 21, 0.15)' : 'transparent',
          borderLeft: isHighlighted ? '3px solid #facc15' : '3px solid transparent',
          paddingLeft: '12px',
          transition: 'all 0.2s ease',
        },
      };
    }, [highlightLine, start]);

    return (
      <div 
        ref={containerRef}
        className={`relative overflow-auto ${className}`}
        onScroll={handleScroll}
        style={{ 
          height: '100%',
          background: 'var(--surface)',
        }}
      >
        {/* 仮想スペーサー（上） */}
        <div style={{ height: start * lineHeight }} />
        
        {/* 表示範囲のコード */}
        <SyntaxHighlighter
          language={language}
          style={customStyle}
          customStyle={{
            margin: 0,
            padding: '16px',
            background: 'transparent',
          }}
          showLineNumbers
          startingLineNumber={start + 1}
          lineProps={lineProps}
          wrapLines
        >
          {visibleCode}
        </SyntaxHighlighter>
        
        {/* 仮想スペーサー（下） */}
        <div style={{ height: (lines.length - end) * lineHeight }} />
      </div>
    );
  }
);

OptimizedSyntaxHighlighter.displayName = 'OptimizedSyntaxHighlighter';