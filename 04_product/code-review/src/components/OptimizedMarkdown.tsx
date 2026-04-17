"use client";

import { memo, useMemo, useCallback, startTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { globalCache } from "@/lib/performance";

interface OptimizedMarkdownProps {
  children: string;
  onCodeClick?: (code: string) => void;
}

// メモ化されたコードコンポーネント
const CodeSpan = memo(({ 
  children, 
  onClick, 
  className = "" 
}: { 
  children: string; 
  onClick?: () => void; 
  className?: string;
}) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) {
      startTransition(() => {
        onClick();
      });
    }
  }, [onClick]);

  return (
    <code 
      className={`
        px-1.5 py-0.5 rounded font-mono text-sm
        ${onClick 
          ? 'bg-purple-50 text-purple-700 border border-purple-200 cursor-pointer hover:bg-purple-100 hover:border-purple-300 transition-colors' 
          : 'bg-gray-100 text-gray-700 border border-gray-200'
        }
        ${className}
      `}
      onClick={onClick ? handleClick : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as any);
        }
      } : undefined}
    >
      {children}
    </code>
  );
});

CodeSpan.displayName = "CodeSpan";

// メモ化されたコードブロックコンポーネント
const CodeBlock = memo(({ 
  children, 
  className,
  language = "text"
}: { 
  children: string; 
  className?: string;
  language?: string;
}) => {
  return (
    <div className="relative group">
      <pre 
        className={`
          p-4 rounded-lg border overflow-x-auto font-mono text-sm
          bg-gray-50 border-gray-200 text-gray-800
          ${className || ''}
        `}
      >
        <code className={`language-${language}`}>
          {children}
        </code>
      </pre>
      
      {/* 言語ラベル */}
      {language && language !== 'text' && (
        <span 
          className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium
                     bg-gray-200 text-gray-600 opacity-0 group-hover:opacity-100 
                     transition-opacity pointer-events-none"
        >
          {language}
        </span>
      )}
    </div>
  );
});

CodeBlock.displayName = "CodeBlock";

export const OptimizedMarkdown = memo<OptimizedMarkdownProps>(({ 
  children, 
  onCodeClick 
}) => {
  // マークダウンの解析結果をキャッシュ
  const processedContent = useMemo(() => {
    const cacheKey = `markdown-${children.slice(0, 100)}`;
    const cached = globalCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 600000) {
      return cached.content;
    }

    // 軽い前処理（必要に応じて）
    const processed = children
      .replace(/\n{3,}/g, '\n\n') // 連続する空行を制限
      .trim();

    const result = { content: processed, timestamp: Date.now() };
    globalCache.set(cacheKey, result);
    
    return processed;
  }, [children]);

  // カスタムコンポーネント群
  const components = useMemo(() => ({
    // インラインコード（クリック可能）
    code: ({ children, className, ...props }: any) => {
      const isInline = !className?.includes('language-');
      const codeText = String(children).replace(/\n$/, '');
      
      if (isInline && onCodeClick) {
        return (
          <CodeSpan 
            onClick={() => onCodeClick(codeText)}
            className={className}
          >
            {codeText}
          </CodeSpan>
        );
      }
      
      return (
        <CodeSpan className={className}>
          {codeText}
        </CodeSpan>
      );
    },

    // コードブロック
    pre: ({ children, ...props }: any) => {
      const codeElement = children?.props;
      if (codeElement?.className?.includes('language-')) {
        const language = codeElement.className.replace('language-', '');
        const codeText = String(codeElement.children).replace(/\n$/, '');
        
        return <CodeBlock language={language}>{codeText}</CodeBlock>;
      }
      
      return (
        <pre className="p-4 rounded-lg border overflow-x-auto font-mono text-sm bg-gray-50 border-gray-200">
          {children}
        </pre>
      );
    },

    // 見出し
    h1: ({ children, ...props }: any) => (
      <h1 className="text-2xl font-bold mb-4 text-gray-900 border-b pb-2" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="text-xl font-bold mb-3 text-gray-900 mt-6" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="text-lg font-semibold mb-2 text-gray-800 mt-4" {...props}>
        {children}
      </h3>
    ),

    // パラグラフ
    p: ({ children, ...props }: any) => (
      <p className="mb-4 text-gray-700 leading-relaxed" {...props}>
        {children}
      </p>
    ),

    // リスト
    ul: ({ children, ...props }: any) => (
      <ul className="mb-4 space-y-1 list-disc list-inside text-gray-700" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="mb-4 space-y-1 list-decimal list-inside text-gray-700" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="ml-2" {...props}>
        {children}
      </li>
    ),

    // 引用
    blockquote: ({ children, ...props }: any) => (
      <blockquote 
        className="border-l-4 border-purple-200 bg-purple-50 p-4 my-4 italic text-gray-700" 
        {...props}
      >
        {children}
      </blockquote>
    ),

    // テーブル
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: any) => (
      <th className="px-4 py-2 bg-gray-100 border-b border-gray-200 font-medium text-gray-900 text-left" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="px-4 py-2 border-b border-gray-100 text-gray-700" {...props}>
        {children}
      </td>
    ),

    // リンク
    a: ({ children, href, ...props }: any) => (
      <a 
        className="text-purple-600 underline hover:text-purple-700 transition-colors"
        href={href}
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        {...props}
      >
        {children}
      </a>
    ),

    // 強調
    strong: ({ children, ...props }: any) => (
      <strong className="font-bold text-gray-900" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }: any) => (
      <em className="italic text-gray-700" {...props}>
        {children}
      </em>
    ),

    // 水平線
    hr: ({ ...props }: any) => (
      <hr className="my-6 border-gray-200" {...props} />
    ),
  }), [onCodeClick]);

  return (
    <div className="markdown-content max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        skipHtml={true} // セキュリティ向上
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

OptimizedMarkdown.displayName = "OptimizedMarkdown";