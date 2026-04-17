"use client";

import { memo, useState, useEffect, useMemo, useCallback } from "react";
import { globalCache, PerformanceMonitor } from "@/lib/performance";

interface LazyCodeJumpMarkdownProps {
  markdown: string;
  onCodeClick?: (snippet: string) => void;
}

// 軽量版のMarkdownレンダラー（初期表示用）
const SimpleMarkdown = memo(({ content, onCodeClick }: {
  content: string;
  onCodeClick?: (snippet: string) => void;
}) => {
  const processedContent = useMemo(() => {
    // 基本的なMarkdown要素を簡単にHTML変換
    let html = content
      // コードブロック
      .replace(/```(\w+)?\n([\s\S]*?)\n```/g, (_, lang, code) => {
        const trimmedCode = code.trim();
        return `<pre class="bg-gray-50 p-3 rounded border overflow-x-auto my-4"><code class="text-sm font-mono" data-code="${encodeURIComponent(trimmedCode)}">${escapeHtml(trimmedCode)}</code></pre>`;
      })
      // インラインコード
      .replace(/`([^`]+)`/g, (_, code) => {
        const trimmedCode = code.trim();
        return `<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono cursor-pointer hover:bg-gray-200 transition-colors" data-code="${encodeURIComponent(trimmedCode)}">${escapeHtml(trimmedCode)}</code>`;
      })
      // 見出し
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-6 mb-3 text-gray-900">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-8 mb-4 text-gray-900">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-6 text-gray-900">$1</h1>')
      // 太字・斜体
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      // リスト
      .replace(/^- (.*$)/gm, '<li class="ml-4 mb-1">• $1</li>')
      // 段落
      .split('\n\n')
      .map(paragraph => {
        if (paragraph.trim() && 
            !paragraph.includes('<h') && 
            !paragraph.includes('<pre') && 
            !paragraph.includes('<li')) {
          return `<p class="mb-4 leading-relaxed text-gray-700">${paragraph.trim()}</p>`;
        }
        return paragraph;
      })
      .join('\n');

    return html;
  }, [content]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const codeData = target.dataset.code;
    
    if (codeData && onCodeClick) {
      const decodedCode = decodeURIComponent(codeData);
      onCodeClick(decodedCode);
    }
  }, [onCodeClick]);

  return (
    <div 
      className="prose max-w-none"
      dangerouslySetInnerHTML={{ __html: processedContent }}
      onClick={handleClick}
    />
  );
});

SimpleMarkdown.displayName = 'SimpleMarkdown';

// HTML エスケープ
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 重いライブラリの遅延読み込み
let ReactMarkdown: any = null;
let remarkGfm: any = null;

const loadMarkdownLibraries = async () => {
  PerformanceMonitor.mark('markdown-import-start');
  
  const cacheKey = 'markdown-module';
  const cached = globalCache.get(cacheKey);
  if (cached) return cached;

  try {
    const [markdownModule, gfmModule] = await Promise.all([
      import('react-markdown').then(mod => mod.default),
      import('remark-gfm').then(mod => mod.default)
    ]);

    ReactMarkdown = markdownModule;
    remarkGfm = gfmModule;

    const result = { ReactMarkdown, remarkGfm };
    globalCache.set(cacheKey, result);
    
    PerformanceMonitor.measure('markdown-import-complete', 'markdown-import-start');
    return result;
    
  } catch (error) {
    console.error('Failed to load markdown libraries:', error);
    return null;
  }
};

export const LazyCodeJumpMarkdown = memo<LazyCodeJumpMarkdownProps>(({
  markdown,
  onCodeClick
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
      { rootMargin: '50px' }
    );

    const element = document.getElementById('markdown-container');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // 可視領域に入ったらライブラリを読み込み
  useEffect(() => {
    if (isVisible && !isLoaded) {
      loadMarkdownLibraries().then((result) => {
        if (result) {
          setIsLoaded(true);
        }
      });
    }
  }, [isVisible, isLoaded]);

  // コードクリックハンドラー（最適化版）
  const handleCodeClick = useCallback((snippet: string) => {
    if (onCodeClick) {
      // クリックイベントをデバウンス
      const timeoutId = setTimeout(() => {
        onCodeClick(snippet);
      }, 50);
      
      return () => clearTimeout(timeoutId);
    }
  }, [onCodeClick]);

  // 軽量版レンダラーを表示（重いライブラリ読み込み前）
  if (!isLoaded) {
    return (
      <div id="markdown-container">
        <SimpleMarkdown content={markdown} onCodeClick={handleCodeClick} />
        {isVisible && (
          <div className="text-xs text-gray-500 mt-2">
            高度なMarkdown機能を読み込み中...
          </div>
        )}
      </div>
    );
  }

  if (!ReactMarkdown || !remarkGfm) {
    return <SimpleMarkdown content={markdown} onCodeClick={handleCodeClick} />;
  }

  // フルのReact Markdown（遅延読み込み後）
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // コードブロック
        pre: ({ children }) => (
          <pre className="bg-gray-50 p-3 rounded border overflow-x-auto my-4">
            {children}
          </pre>
        ),
        code: ({ children, className, ...props }) => {
          const isInline = !className;
          const content = String(children).replace(/\n$/, '');
          
          if (isInline) {
            return (
              <code
                className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono cursor-pointer hover:bg-gray-200 transition-colors"
                onClick={() => handleCodeClick(content)}
                {...props}
              >
                {children}
              </code>
            );
          }
          
          return (
            <code
              className="text-sm font-mono cursor-pointer hover:bg-gray-100 transition-colors block p-2 rounded"
              onClick={() => handleCodeClick(content)}
              {...props}
            >
              {children}
            </code>
          );
        },
        // 見出し
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold mt-8 mb-6 text-gray-900">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-semibold mt-8 mb-4 text-gray-900">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold mt-6 mb-3 text-gray-900">{children}</h3>
        ),
        // 段落
        p: ({ children }) => (
          <p className="mb-4 leading-relaxed text-gray-700">{children}</p>
        ),
        // リスト
        ul: ({ children }) => (
          <ul className="mb-4 space-y-1">{children}</ul>
        ),
        li: ({ children }) => (
          <li className="ml-4">• {children}</li>
        ),
        // 強調
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900">{children}</strong>
        ),
        // リンク（外部リンクは新しいタブで開く）
        a: ({ href, children }) => (
          <a
            href={href}
            target={href?.startsWith('http') ? '_blank' : undefined}
            rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="text-purple-600 hover:text-purple-800 underline transition-colors"
          >
            {children}
          </a>
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
});

LazyCodeJumpMarkdown.displayName = 'LazyCodeJumpMarkdown';