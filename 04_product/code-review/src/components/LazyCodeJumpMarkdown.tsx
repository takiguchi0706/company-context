"use client";

import { Suspense } from "react";
import { OptimizedMarkdown } from "./OptimizedMarkdown";

interface LazyCodeJumpMarkdownProps {
  markdown: string;
  onCodeClick?: (code: string) => void;
}

// ローディングコンポーネント
function MarkdownSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* ヘッダー */}
      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
      
      {/* パラグラフ */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
      </div>
      
      {/* コードブロック */}
      <div className="h-32 bg-gray-100 rounded-lg border"></div>
      
      {/* パラグラフ */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-4/5"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
      
      {/* リスト */}
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/5"></div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
          <div className="h-4 bg-gray-200 rounded w-2/5"></div>
        </div>
      </div>
    </div>
  );
}

export function LazyCodeJumpMarkdown({ markdown, onCodeClick }: LazyCodeJumpMarkdownProps) {
  return (
    <Suspense fallback={<MarkdownSkeleton />}>
      <OptimizedMarkdown onCodeClick={onCodeClick}>
        {markdown}
      </OptimizedMarkdown>
    </Suspense>
  );
}