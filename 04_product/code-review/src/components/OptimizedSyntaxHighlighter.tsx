"use client";

import { memo, useMemo, Suspense } from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { getVisibleRange, globalCache } from "@/lib/performance";
import { useVirtualScroll } from "@/lib/hooks/useVirtualScroll";

// 必要な言語のみを動的に読み込み
const loadLanguage = async (language: string) => {
  const langMap: Record<string, () => Promise<any>> = {
    javascript: () => import("react-syntax-highlighter/dist/esm/languages/hljs/javascript"),
    typescript: () => import("react-syntax-highlighter/dist/esm/languages/hljs/typescript"),
    python: () => import("react-syntax-highlighter/dist/esm/languages/hljs/python"),
    go: () => import("react-syntax-highlighter/dist/esm/languages/hljs/go"),
    rust: () => import("react-syntax-highlighter/dist/esm/languages/hljs/rust"),
    java: () => import("react-syntax-highlighter/dist/esm/languages/hljs/java"),
    cpp: () => import("react-syntax-highlighter/dist/esm/languages/hljs/cpp"),
    php: () => import("react-syntax-highlighter/dist/esm/languages/hljs/php"),
    ruby: () => import("react-syntax-highlighter/dist/esm/languages/hljs/ruby"),
  };

  const loader = langMap[language];
  if (loader) {
    const lang = await loader();
    SyntaxHighlighter.registerLanguage(language, lang.default);
  }
};

interface OptimizedSyntaxHighlighterProps {
  code: string;
  language: string;
  highlightLine?: number | null;
  className?: string;
}

const LOADING_SKELETON = (
  <div className="h-full bg-gray-50 animate-pulse rounded-lg border flex items-center justify-center">
    <div className="text-sm text-gray-500">コードを読み込み中...</div>
  </div>
);

// メモ化されたコード行コンポーネント
const CodeLine = memo(({ 
  line, 
  lineNumber, 
  isHighlighted, 
  language 
}: { 
  line: string; 
  lineNumber: number; 
  isHighlighted: boolean; 
  language: string;
}) => {
  const cacheKey = `code-line-${language}-${lineNumber}-${line.slice(0, 50)}`;
  
  return useMemo(() => (
    <div 
      className={`
        relative px-4 py-1 border-l-2 transition-all duration-300
        ${isHighlighted 
          ? 'bg-yellow-100 border-yellow-400 shadow-sm' 
          : 'border-transparent'
        }
      `}
      data-line={lineNumber}
    >
      <span className="absolute left-2 top-1 text-xs text-gray-400 select-none w-6">
        {lineNumber}
      </span>
      <pre className="ml-8 font-mono text-sm overflow-x-auto">
        <code>{line}</code>
      </pre>
    </div>
  ), [line, lineNumber, isHighlighted, cacheKey]);
});

CodeLine.displayName = "CodeLine";

// バーチャルスクロール対応のシンタックスハイライター
export const OptimizedSyntaxHighlighter = memo<OptimizedSyntaxHighlighterProps>(({
  code,
  language,
  highlightLine,
  className = "",
}) => {
  const lines = useMemo(() => code.split('\n'), [code]);
  const totalLines = lines.length;

  // 大きなファイルの場合はバーチャルスクロールを使用
  const shouldUseVirtual = totalLines > 100;

  const { 
    containerRef, 
    visibleRange, 
    scrollToLine,
    containerHeight 
  } = useVirtualScroll({
    totalItems: totalLines,
    itemHeight: 24,
    enabled: shouldUseVirtual,
  });

  // 言語の動的読み込み
  useMemo(() => {
    if (language && language !== 'text') {
      loadLanguage(language).catch(console.warn);
    }
  }, [language]);

  // ハイライト行への自動スクロール
  useMemo(() => {
    if (highlightLine && scrollToLine) {
      const timer = setTimeout(() => {
        scrollToLine(highlightLine - 1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [highlightLine, scrollToLine]);

  // 軽量表示（バーチャルスクロール使用時）
  const renderVirtualized = () => {
    if (!visibleRange) return null;

    const { start, end } = visibleRange;
    const visibleLines = lines.slice(start, end);
    const paddingTop = start * 24;
    const paddingBottom = (totalLines - end) * 24;

    return (
      <div 
        ref={containerRef}
        className={`h-full overflow-y-auto border rounded-lg ${className}`}
        style={{ 
          background: "var(--surface)",
          borderColor: "var(--border)" 
        }}
      >
        <div style={{ paddingTop, paddingBottom }}>
          {visibleLines.map((line, index) => {
            const lineNumber = start + index + 1;
            return (
              <CodeLine
                key={lineNumber}
                line={line}
                lineNumber={lineNumber}
                isHighlighted={highlightLine === lineNumber}
                language={language}
              />
            );
          })}
        </div>
      </div>
    );
  };

  // 通常表示（小さなファイル用）
  const renderNormal = () => {
    const cacheKey = `syntax-${language}-${code.slice(0, 100)}`;
    const cached = globalCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 300000) {
      return (
        <div className={`h-full overflow-y-auto ${className}`}>
          <div dangerouslySetInnerHTML={{ __html: cached.html }} />
        </div>
      );
    }

    return (
      <div className={`h-full overflow-y-auto ${className}`}>
        <SyntaxHighlighter
          language={language}
          style={oneLight}
          showLineNumbers={true}
          lineNumberStyle={{ 
            color: '#9ca3af', 
            fontSize: '12px',
            paddingRight: '16px',
            userSelect: 'none',
            minWidth: '32px'
          }}
          customStyle={{
            margin: 0,
            padding: '16px',
            background: 'var(--surface)',
            fontSize: '14px',
            lineHeight: '1.5',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}
          wrapLines={true}
          lineProps={(lineNumber) => ({
            style: {
              display: 'block',
              backgroundColor: highlightLine === lineNumber 
                ? 'rgba(251, 191, 36, 0.2)' 
                : 'transparent',
              borderLeft: highlightLine === lineNumber 
                ? '3px solid #fbbf24' 
                : '3px solid transparent',
              paddingLeft: '8px',
              transition: 'all 0.3s ease',
            }
          })}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  };

  if (shouldUseVirtual) {
    return (
      <Suspense fallback={LOADING_SKELETON}>
        {renderVirtualized()}
      </Suspense>
    );
  }

  return (
    <Suspense fallback={LOADING_SKELETON}>
      {renderNormal()}
    </Suspense>
  );
});

OptimizedSyntaxHighlighter.displayName = "OptimizedSyntaxHighlighter";