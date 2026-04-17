"use client";

import { memo, useMemo, lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { withCache } from "@/lib/performance";

// Code コンポーネントを遅延読み込み
const OptimizedSyntaxHighlighter = lazy(
  () => import("./OptimizedSyntaxHighlighter").then(mod => ({ default: mod.OptimizedSyntaxHighlighter }))
);

interface OptimizedMarkdownProps {
  children: string;
  onCodeClick?: (code: string) => void;
  className?: string;
}

// マークダウンの前処理キャッシュ
function preprocessMarkdown(content: string): string {
  return withCache(
    `preprocess-${content.slice(0, 100)}`,
    () => {
      // 改行の正規化
      return content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // 連続する改行を制限
        .replace(/\n{4,}/g, '\n\n\n');
    }
  );
}

// コードブロックコンポーネント（メモ化）
const CodeBlock = memo(function CodeBlock({
  className,
  children,
  onCodeClick,
}: {
  className?: string;
  children: React.ReactNode;
  onCodeClick?: (code: string) => void;
}) {
  const language = className?.replace('language-', '') || 'text';
  const code = String(children).replace(/\n$/, '');

  return (
    <div className="relative group">
      <Suspense
        fallback={
          <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
            <code>{code}</code>
          </pre>
        }
      >
        <OptimizedSyntaxHighlighter
          code={code}
          language={language}
          className="rounded-lg"
        />
      </Suspense>
      {onCodeClick && (
        <button
          onClick={() => onCodeClick(code)}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white px-2 py-1 rounded text-xs font-medium shadow"
          title="ソースコードにジャンプ"
        >
          ↗
        </button>
      )}
    </div>
  );
});

// インラインコードコンポーネント（メモ化）
const InlineCode = memo(function InlineCode({
  children,
  onCodeClick,
}: {
  children: React.ReactNode;
  onCodeClick?: (code: string) => void;
}) {
  const code = String(children);
  
  return (
    <code
      className={`px-1.5 py-0.5 rounded text-sm font-mono bg-gray-100 hover:bg-gray-200 transition-colors ${
        onCodeClick ? 'cursor-pointer' : ''
      }`}
      onClick={onCodeClick ? () => onCodeClick(code) : undefined}
      title={onCodeClick ? 'クリックでソースコードにジャンプ' : undefined}
    >
      {children}
    </code>
  );
});

export const OptimizedMarkdown = memo(function OptimizedMarkdown({
  children,
  onCodeClick,
  className = "",
}: OptimizedMarkdownProps) {
  // マークダウンコンポーネントをメモ化
  const components = useMemo(
    () => ({
      code: ({ className, children, ...props }: any) => {
        const hasNewlines = String(children).includes('\n');
        
        if (hasNewlines) {
          return (
            <CodeBlock
              className={className}
              onCodeClick={onCodeClick}
              {...props}
            >
              {children}
            </CodeBlock>
          );
        }
        
        return (
          <InlineCode onCodeClick={onCodeClick} {...props}>
            {children}
          </InlineCode>
        );
      },
      // その他のコンポーネントも最適化
      h1: ({ children, ...props }: any) => (
        <h1 className="text-2xl font-bold mb-4 mt-6" {...props}>
          {children}
        </h1>
      ),
      h2: ({ children, ...props }: any) => (
        <h2 className="text-xl font-bold mb-3 mt-5" {...props}>
          {children}
        </h2>
      ),
      h3: ({ children, ...props }: any) => (
        <h3 className="text-lg font-semibold mb-2 mt-4" {...props}>
          {children}
        </h3>
      ),
      p: ({ children, ...props }: any) => (
        <p className="mb-3 leading-relaxed" {...props}>
          {children}
        </p>
      ),
      ul: ({ children, ...props }: any) => (
        <ul className="list-disc pl-6 mb-3 space-y-1" {...props}>
          {children}
        </ul>
      ),
      ol: ({ children, ...props }: any) => (
        <ol className="list-decimal pl-6 mb-3 space-y-1" {...props}>
          {children}
        </ol>
      ),
      blockquote: ({ children, ...props }: any) => (
        <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4" {...props}>
          {children}
        </blockquote>
      ),
      table: ({ children, ...props }: any) => (
        <div className="overflow-x-auto my-4">
          <table className="min-w-full border-collapse border border-gray-300" {...props}>
            {children}
          </table>
        </div>
      ),
      th: ({ children, ...props }: any) => (
        <th className="border border-gray-300 px-4 py-2 bg-gray-50 font-semibold text-left" {...props}>
          {children}
        </th>
      ),
      td: ({ children, ...props }: any) => (
        <td className="border border-gray-300 px-4 py-2" {...props}>
          {children}
        </td>
      ),
    }),
    [onCodeClick]
  );

  // 前処理されたマークダウンをメモ化
  const processedContent = useMemo(
    () => preprocessMarkdown(children),
    [children]
  );

  return (
    <div className={`prose max-w-none ${className}`}>
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm]}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});