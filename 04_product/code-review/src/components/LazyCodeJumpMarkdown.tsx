"use client";

import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// 遅延読み込みコンポーネント
const CodeJumpMarkdown = lazy(() => 
  import("./CodeJumpMarkdown").then(module => ({ 
    default: module.CodeJumpMarkdown 
  }))
);

interface LazyCodeJumpMarkdownProps {
  markdown: string;
  onCodeClick?: (snippet: string) => void;
}

const LoadingFallback = () => (
  <div className="flex items-center gap-2 py-4" style={{ color: "var(--muted)" }}>
    <Loader2 className="w-4 h-4 animate-spin" />
    <span className="text-sm">レンダリング中...</span>
  </div>
);

export function LazyCodeJumpMarkdown({ markdown, onCodeClick }: LazyCodeJumpMarkdownProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CodeJumpMarkdown 
        markdown={markdown} 
        onCodeClick={onCodeClick} 
      />
    </Suspense>
  );
}