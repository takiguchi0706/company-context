"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useVirtualizedLines, globalCache } from '@/lib/performance';

interface OptimizedSyntaxHighlighterProps {
  code: string;
  language: string;
  highlightLine?: number | null;
  onLineClick?: (lineNum: number) => void;
  className?: string;
}

// 大きなファイル（1000行以上）は仮想化
const VIRTUALIZATION_THRESHOLD = 1000;
const LINE_HEIGHT = 24; // px

export function OptimizedSyntaxHighlighter({
  code,
  language,
  highlightLine,
  onLineClick,
  className,
}: OptimizedSyntaxHighlighterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [scrollTop, setScrollTop] = useState(0);

  const lines = useMemo(() => code.split('\n'), [code]);
  const shouldVirtualize = lines.length > VIRTUALIZATION_THRESHOLD;

  // キャッシュキーを生成
  const cacheKey = useMemo(() => {
    return `syntax-${language}-${code.slice(0, 100)}-${code.length}`;
  }, [language, code]);

  // コンテナサイズの監視
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 仮想化用のライン計算
  const { getVisibleLines } = useVirtualizedLines(code, containerHeight, LINE_HEIGHT);

  const renderContent = useMemo(() => {
    // キャッシュから取得を試行
    const cached = globalCache.get(cacheKey);
    if (cached && !highlightLine) {
      return cached;
    }

    let content;

    if (shouldVirtualize) {
      // 仮想化レンダリング
      const { startIndex, visibleLines, totalHeight } = getVisibleLines(scrollTop);
      
      content = (
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div 
            style={{ 
              transform: `translateY(${startIndex * LINE_HEIGHT}px)`,
              position: 'absolute',
              width: '100%'
            }}
          >
            <SyntaxHighlighter
              language={language}
              style={atomDark}
              showLineNumbers
              startingLineNumber={startIndex + 1}
              wrapLines
              lineProps={(lineNum) => ({
                "data-line": String(startIndex + lineNum),
                style: {
                  display: "block",
                  paddingLeft: "4px",
                  marginLeft: "-4px",
                  height: `${LINE_HEIGHT}px`,
                  borderLeft: (startIndex + lineNum) === highlightLine
                    ? "3px solid #facc15"
                    : "3px solid transparent",
                  background: (startIndex + lineNum) === highlightLine
                    ? "rgba(250,204,21,0.18)"
                    : undefined,
                  cursor: onLineClick ? 'pointer' : 'default',
                } as React.CSSProperties,
                onClick: onLineClick ? () => onLineClick(startIndex + lineNum) : undefined,
              })}
              customStyle={{
                margin: 0,
                borderRadius: 0,
                fontSize: "0.8125rem",
                background: 'transparent',
              }}
            >
              {visibleLines.join('\n')}
            </SyntaxHighlighter>
          </div>
        </div>
      );
    } else {
      // 通常レンダリング
      content = (
        <SyntaxHighlighter
          language={language}
          style={atomDark}
          showLineNumbers
          wrapLines
          lineProps={(lineNum) => ({
            "data-line": String(lineNum),
            style: {
              display: "block",
              paddingLeft: "4px",
              marginLeft: "-4px",
              borderLeft: lineNum === highlightLine
                ? "3px solid #facc15"
                : "3px solid transparent",
              background: lineNum === highlightLine
                ? "rgba(250,204,21,0.18)"
                : undefined,
              animation: lineNum === highlightLine
                ? "highlightFade 2.5s ease forwards"
                : undefined,
              transition: "background 0.3s, border-color 0.3s",
              cursor: onLineClick ? 'pointer' : 'default',
            } as React.CSSProperties,
            onClick: onLineClick ? () => onLineClick(lineNum) : undefined,
          })}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: "0.8125rem",
            minHeight: "100%",
          }}
        >
          {code}
        </SyntaxHighlighter>
      );

      // キャッシュに保存（ハイライトなしの場合のみ）
      if (!highlightLine) {
        globalCache.set(cacheKey, content);
      }
    }

    return content;
  }, [
    cacheKey, shouldVirtualize, getVisibleLines, scrollTop, language, 
    highlightLine, onLineClick, code, lines.length
  ]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={className}
      style={{ height: '100%', overflow: 'auto' }}
      onScroll={shouldVirtualize ? handleScroll : undefined}
    >
      {renderContent}
      
      {/* パフォーマンス情報表示（開発時のみ） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 bg-black/80 text-white text-xs p-2 rounded">
          <div>Lines: {lines.length}</div>
          <div>Mode: {shouldVirtualize ? 'Virtualized' : 'Normal'}</div>
          <div>Cache: {globalCache.get(cacheKey) ? 'Hit' : 'Miss'}</div>
        </div>
      )}
    </div>
  );
}