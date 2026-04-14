"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface Props {
  markdown: string;
  onCodeClick: (snippet: string) => void;
}

/** React要素のツリーからテキストを再帰的に取り出す */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) {
    return extractText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

export function CodeJumpMarkdown({ markdown, onCodeClick }: Props) {
  const components: Components = {
    // ブロックコード（```...```）の外側 <pre> をクリック可能にする
    pre({ children, ...props }) {
      const snippet = extractText(children).trim();

      return (
        <div
          className="relative group cursor-pointer"
          onClick={() => onCodeClick(snippet)}
          title="クリックでソースの該当箇所にジャンプ"
        >
          {/* hover 時の枠線オーバーレイ */}
          <div className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity ring-2 ring-purple-400" />
          <pre {...props}>{children}</pre>
          {/* ヒントラベル */}
          <span className="absolute top-1.5 right-2 text-xs text-purple-300 opacity-0 group-hover:opacity-100 transition-opacity select-none">
            ↑ ジャンプ
          </span>
        </div>
      );
    },

    // インラインコード（`...`）をクリック可能にする
    // ブロックコード内の <code> は className="language-*" が付くので除外
    code({ className: codeClass, children, ...props }) {
      const isBlock = codeClass?.startsWith("language-");
      const text = extractText(children).trim();

      if (isBlock) {
        // ブロックコードの内側 <code> — pre 側でクリック処理するのでそのまま
        return (
          <code className={codeClass} {...props}>
            {children}
          </code>
        );
      }

      // インラインコード
      return (
        <code
          className={codeClass}
          style={{ cursor: "pointer" }}
          title="クリックでソースの該当箇所にジャンプ"
          onClick={(e) => {
            e.stopPropagation();
            onCodeClick(text);
          }}
          {...props}
        >
          {children}
        </code>
      );
    },
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
    >
      {markdown}
    </ReactMarkdown>
  );
}
