"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  BookOpen,
  RotateCcw,
  Copy,
  Check,
  Send,
  Loader2,
  ChevronDown,
} from "lucide-react";

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

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLInputElement>(null);

  // sessionStorage からリクエストを読み込み
  useEffect(() => {
    const stored = sessionStorage.getItem("review-request");
    if (!stored) {
      router.replace("/");
      return;
    }
    const req = JSON.parse(stored) as ReviewRequest;
    setRequest(req);
    generateExplanation(req);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // チャット履歴が増えたら末尾にスクロール
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, explanation]);

  async function generateExplanation(req: ReviewRequest) {
    setLoading(true);
    setError("");
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
      setExplanation(data.explanation);
      setMeta({
        input_tokens: data.input_tokens,
        output_tokens: data.output_tokens,
        cost_usd: data.cost_usd,
        elapsed_ms: data.elapsed_ms,
      });
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(explanation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [explanation]);

  const handleSendQuestion = useCallback(async () => {
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
  }, [question, chatLoading, request, chatHistory]);

  if (!request) return null;

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
            <span>{request.code.split("\n").length} 行</span>
          </div>
          <div className="flex-1 overflow-auto">
            <SyntaxHighlighter
              language={request.language.toLowerCase().replace("c++", "cpp").replace("その他", "text")}
              style={atomDark}
              showLineNumbers
              wrapLongLines={false}
              customStyle={{
                margin: 0,
                borderRadius: 0,
                fontSize: "0.8125rem",
                height: "100%",
                minHeight: "100%",
              }}
            >
              {request.code}
            </SyntaxHighlighter>
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
              <span>📊 入力 {meta.input_tokens.toLocaleString()} / 出力 {meta.output_tokens.toLocaleString()} tokens</span>
              <span>💰 ${meta.cost_usd.toFixed(4)}</span>
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {explanation}
                </ReactMarkdown>
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
                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", color: "#fff" }}
                      >
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        className="prose max-w-none p-4 rounded-2xl rounded-tl-sm text-sm"
                        style={{ background: "var(--surface)" }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
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
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendQuestion()}
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
                onClick={handleSendQuestion}
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
