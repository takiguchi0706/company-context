"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  RotateCcw,
  Copy,
  Check,
  Send,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { CodeJumpMarkdown } from "@/components/CodeJumpMarkdown";
import { OptimizedSyntaxHighlighter } from "@/components/OptimizedSyntaxHighlighter";
import { useDebounce, globalCache } from "@/lib/performance";

interface ReviewRequest {
  code: string;
  language: string;
  level: "elementary" | "middle" | "engineer";
  mode: "explain" | "review";
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const LEVEL_LABEL: Record<string, string> = {
  elementary: "🧒 小学生向け",
  middle: "🧑‍🎓 中高生向け",
  engineer: "👨‍💻 エンジニア向け",
};

// ─── マッチングユーティリティ ─────────────────────────────────────────────

/** タブ→スペース、連続スペース→1つ、trim */
function normalizeWS(s: string): string {
  return s.replace(/\t/g, " ").replace(/ {2,}/g, " ").trim();
}

/** ソース内の全出現位置を 1-based 行番号の配列で返す */
function allLineOccurrences(src: string, needle: string): number[] {
  const result: number[] = [];
  let start = 0;
  while (true) {
    const idx = src.indexOf(needle, start);
    if (idx === -1) break;
    result.push(src.slice(0, idx).split("\n").length);
    start = idx + 1;
  }
  return result;
}

/** 識別子（英数字アンダースコア、3文字以上）を抽出して長い順に返す */
function extractIdentifiers(s: string): string[] {
  const matches = [...s.matchAll(/[a-zA-Z_$][a-zA-Z0-9_$]{2,}/g)].map((m) => m[0]);
  return [...new Set(matches)].sort((a, b) => b.length - a.length);
}

const ELLIPSIS_LINES = new Set(["...", "// ...", "# ...", "/* ... */", "…"]);

/**
 * 多段フォールバックでマッチする行番号（1-based）を全て返す
 * Step1: 完全一致 → Step2: 意味のある行単位一致 → Step3: 空白正規化行マッチ
 * → Step4: 最長識別子 \b正規表現 → Step5: 空配列（未マッチ）
 */
function findMatchingLines(sourceCode: string, snippet: string): number[] {
  const trimmed = snippet.trim();
  if (!trimmed || trimmed.length < 2) return [];

  // キャッシュから取得を試行
  const cacheKey = `match-${sourceCode.slice(0, 50)}-${trimmed.slice(0, 30)}`;
  const cached = globalCache.get(cacheKey);
  if (cached) return cached;

  // Step 1: 完全一致
  const exact = allLineOccurrences(sourceCode, trimmed);
  if (exact.length > 0) {
    globalCache.set(cacheKey, exact);
    return exact;
  }

  const srcLines = sourceCode.split("\n");
  const normSrcLines = srcLines.map(normalizeWS);

  // Step 2 & 3: 意味のある行（省略・空行を除く）を1行ずつ検索
  const candidateLines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && !ELLIPSIS_LINES.has(l));

  for (const line of candidateLines) {
    // Step 2: そのまま substring match
    const direct = allLineOccurrences(sourceCode, line);
    if (direct.length > 0) {
      globalCache.set(cacheKey, direct);
      return direct;
    }

    // Step 3: 空白正規化
    const normLine = normalizeWS(line);
    const normMatches = normSrcLines.reduce<number[]>((acc, srcLine, i) => {
      if (srcLine === normLine || srcLine.includes(normLine)) acc.push(i + 1);
      return acc;
    }, []);
    if (normMatches.length > 0) {
      globalCache.set(cacheKey, normMatches);
      return normMatches;
    }
  }

  // Step 4: 最長識別子で \b正規表現マッチ
  const identifiers = extractIdentifiers(trimmed);
  for (const id of identifiers) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    const lineNums: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(sourceCode)) !== null) {
      lineNums.push(sourceCode.slice(0, m.index).split("\n").length);
    }
    if (lineNums.length > 0) {
      const result = [...new Set(lineNums)];
      globalCache.set(cacheKey, result);
      return result;
    }
  }

  const emptyResult: number[] = [];
  globalCache.set(cacheKey, emptyResult);
  return emptyResult;
}

export default function ExplainPage() {
  const router = useRouter();

  const [request, setRequest] = useState<ReviewRequest | null>(null);
  const [explanation, setExplanation] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [meta, setMeta] = useState<{
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    elapsed_ms: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // コードジャンプ用
  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const [notFoundFlash, setNotFoundFlash] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notFoundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 連続クリックで次のマッチへ進むための状態
  const lastJumpRef = useRef<{ snippet: string; matchIndex: number }>({
    snippet: "",
    matchIndex: -1,
  });

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLInputElement>(null);

  // デバウンスされた質問送信
  const debouncedSendQuestion = useDebounce(handleSendQuestion, 300);

  // sessionStorage からリクエストを読み込み
  useEffect(() => {
    const stored = sessionStorage.getItem("review-request");
    if (!stored) {
      router.replace("/");
      return;
    }
    const req = JSON.parse(stored) as ReviewRequest;
    setRequest(req);
    
    // 解説のキャッシュを確認
    const explanationCacheKey = `explanation-${req.code.slice(0, 100)}-${req.level}-${req.mode}`;
    const cachedExplanation = globalCache.get(explanationCacheKey);
    
    if (cachedExplanation) {
      setExplanation(cachedExplanation.explanation);
      setMeta(cachedExplanation.meta);
      setLoading(false);
    } else {
      generateExplanation(req);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // チャット履歴が増えたら末尾にスクロール（デバウンス）
  useEffect(() => {
    const timer = setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [chatHistory, explanation]);

  // アンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (notFoundTimerRef.current) clearTimeout(notFoundTimerRef.current);
    };
  }, []);

  async function generateExplanation(req: ReviewRequest) {
    setLoading(true);
    setError("");
    
    const explanationCacheKey = `explanation-${req.code.slice(0, 100)}-${req.level}-${req.mode}`;
    
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: req.code,
          language: req.language,
          level: req.level,
          mode: req.mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "解説の生成に失敗しました");
        return;
      }
      
      const result = {
        explanation: data.explanation,
        meta: {
          input_tokens: data.input_tokens,
          output_tokens: data.output_tokens,
          cost_usd: data.cost_usd,
          elapsed_ms: data.elapsed_ms,
        }
      };
      
      setExplanation(result.explanation);
      setMeta(result.meta);
      
      // 結果をキャッシュ
      globalCache.set(explanationCacheKey, result);
      
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  /** 解説内コードをクリック → 左パネルの該当行にスクロール＋ハイライト（連続クリックで次のマッチへ） */
  const jumpToCode = useCallback(
    (snippet: string) => {
      if (!request?.code) return;

      const matches = findMatchingLines(request.code, snippet);

      if (matches.length === 0) {
        console.warn("[code-jump] no match for:", snippet.slice(0, 80));
        if (notFoundTimerRef.current) clearTimeout(notFoundTimerRef.current);
        setNotFoundFlash(true);
        notFoundTimerRef.current = setTimeout(() => setNotFoundFlash(false), 2000);
        return;
      }

      // 同じスニペットの連続クリック → 次のマッチへ（ラップあり）
      let matchIndex = 0;
      if (lastJumpRef.current.snippet === snippet) {
        matchIndex = (lastJumpRef.current.matchIndex + 1) % matches.length;
      }
      lastJumpRef.current = { snippet, matchIndex };

      const lineNum = matches[matchIndex];

      // 既存ハイライトをリセット
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      setHighlightLine(null);

      requestAnimationFrame(() => {
        setHighlightLine(lineNum);
        highlightTimerRef.current = setTimeout(() => setHighlightLine(null), 2500);
      });
    },
    [request]
  );

  const handleCopy = useCallback(async () => {
    if (!explanation) return;
    await navigator.clipboard.writeText(explanation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [explanation]);

  async function handleSendQuestion() {
    if (!question.trim() || chatLoading || !request) return;

    const userQuestion = question.trim();
    setQuestion("");
    setChatLoading(true);

    const newHistory: ChatMessage[] = [
      ...chatHistory,
      { role: "user", content: userQuestion },
    ];
    setChatHistory(newHistory);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: request.code,
          language: request.language,
          level: request.level,
          question: userQuestion,
          history: chatHistory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChatHistory([
          ...newHistory,
          { role: "assistant", content: `エラー: ${data.error ?? "回答の生成に失敗しました"}` },
        ]);
        return;
      }
      setChatHistory([
        ...newHistory,
        { role: "assistant", content: data.answer },
      ]);
    } catch {
      setChatHistory([
        ...newHistory,
        { role: "assistant", content: "ネットワークエラーが発生しました" },
      ]);
    } finally {
      setChatLoading(false);
      setTimeout(() => questionInputRef.current?.focus(), 100);
    }
  }

  const handleQuestionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuestion(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      debouncedSendQuestion();
    }
  }, [debouncedSendQuestion]);

  if (!request) return null;

  const syntaxLang = request.language
    .toLowerCase()
    .replace("c++", "cpp")
    .replace("その他", "text");

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="flex-none flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5" style={{ color: "var(--accent-from)" }} />
          <span className="font-bold gradient-text">code-review</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}
          >
            {LEVEL_LABEL[request.level]}
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: "var(--surface)", color: "var(--muted)" }}
          >
            {request.language}
          </span>
          {request.mode === "review" && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: "rgba(234,179,8,0.1)", color: "#ca8a04" }}
            >
              レビューモード
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {explanation && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
              style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--surface)" }}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "コピー済み" : "解説をコピー"}
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-bg text-white text-xs font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            別のコードで試す
          </button>
        </div>
      </header>

      {/* Main 2-column layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* Left: Code viewer */}
        <div
          className="flex flex-col overflow-hidden border-r"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="flex-none px-4 py-2 border-b flex items-center justify-between text-xs"
            style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--surface)" }}
          >
            <span className="font-mono">{request.language}</span>
            <span className="flex items-center gap-2">
              <span>{request.code.split("\n").length} 行</span>
              {highlightLine && !notFoundFlash && (
                <span
                  className="px-1.5 py-0.5 rounded text-xs font-medium"
                  style={{ background: "rgba(250,204,21,0.2)", color: "#ca8a04" }}
                >
                  → {highlightLine} 行目
                </span>
              )}
              {notFoundFlash && (
                <span
                  className="px-1.5 py-0.5 rounded text-xs font-medium animate-pulse"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#dc2626" }}
                >
                  ⚠ 対応箇所が見つかりません
                </span>
              )}
            </span>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <OptimizedSyntaxHighlighter
              code={request.code}
              language={syntaxLang}
              highlightLine={highlightLine}
              className="h-full"
            />
          </div>
        </div>

        {/* Right: Explanation + Chat */}
        <div className="flex flex-col overflow-hidden">
          {/* Meta info */}
          {meta && (
            <div
              className="flex-none px-4 py-2 border-b flex items-center gap-4 text-xs flex-wrap"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }}
            >
              <span>🕐 {(meta.elapsed_ms / 1000).toFixed(1)}s</span>
              <span>
                📊 入力 {meta.input_tokens.toLocaleString()} / 出力{" "}
                {meta.output_tokens.toLocaleString()} tokens
              </span>
              <span>💰 ${meta.cost_usd.toFixed(4)}</span>
              {explanation && (
                <span style={{ color: "rgba(124,58,237,0.7)" }}>
                  💡 コードをクリックでソースにジャンプ
                </span>
              )}
            </div>
          )}

          {/* Explanation + chat history (scrollable) */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {loading && (
              <div className="flex items-center gap-3 py-8">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#7c3aed" }} />
                <span style={{ color: "var(--muted)" }}>AIが解説を生成しています...</span>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <p className="font-medium">エラーが発生しました</p>
                <p>{error}</p>
                <button
                  onClick={() => generateExplanation(request)}
                  className="mt-2 text-red-600 underline text-xs"
                >
                  再試行する
                </button>
              </div>
            )}

            {explanation && (
              <div className="prose max-w-none">
                <CodeJumpMarkdown
                  markdown={explanation}
                  onCodeClick={jumpToCode}
                />
              </div>
            )}

            {/* Chat history */}
            {chatHistory.length > 0 && (
              <div className="space-y-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                  <ChevronDown className="w-3 h-3 inline mr-1" />
                  追加の質問と回答
                </p>
                {chatHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={msg.role === "user" ? "flex justify-end" : ""}
                  >
                    {msg.role === "user" ? (
                      <div
                        className="max-w-[80%] px-4 py-2 rounded-2xl rounded-tr-sm text-sm"
                        style={{
                          background: "linear-gradient(135deg, #7c3aed, #2563eb)",
                          color: "#fff",
                        }}
                      >
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        className="prose max-w-none p-4 rounded-2xl rounded-tl-sm text-sm w-full"
                        style={{ background: "var(--surface)" }}
                      >
                        <CodeJumpMarkdown
                          markdown={msg.content}
                          onCodeClick={jumpToCode}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    回答を生成中...
                  </div>
                )}
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Question bar (fixed bottom) */}
          <div
            className="flex-none px-4 py-3 border-t"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          >
            <div className="flex gap-2">
              <input
                ref={questionInputRef}
                type="text"
                value={question}
                onChange={handleQuestionChange}
                onKeyDown={handleKeyDown}
                placeholder="このコードについて質問する..."
                disabled={loading || chatLoading}
                className="flex-1 px-3 py-2 rounded-lg border text-sm"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <button
                onClick={debouncedSendQuestion}
                disabled={!question.trim() || loading || chatLoading}
                className="px-3 py-2 rounded-lg gradient-bg text-white disabled:opacity-50 transition-opacity"
              >
                {chatLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Enter で送信
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}