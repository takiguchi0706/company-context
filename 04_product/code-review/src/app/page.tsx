"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, GitBranch, FolderOpen, Loader2, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { preloadRoute, useDebounce, PerformanceMonitor, dedupeRequest } from "@/lib/performance";
import { usePerformance, useWebVitals } from "@/hooks/usePerformance";

const LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C++",
  "PHP",
  "Ruby",
  "その他",
];

type Tab = "paste" | "github-url" | "company";
type Level = "elementary" | "middle" | "engineer";
type Mode = "explain" | "review";

export default function HomePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { measurePerformance, trackInteraction, reportPerformance } = usePerformance('HomePage');

  // Web Vitals tracking in development
  useWebVitals();

  const [tab, setTab] = useState<Tab>("paste");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("TypeScript");
  const [level, setLevel] = useState<Level>("elementary");
  const [githubUrl, setGithubUrl] = useState("");
  const [companyPath, setCompanyPath] = useState("");
  const [loadingGithub, setLoadingGithub] = useState(false);
  const [githubError, setGithubError] = useState("");

  const canSubmit = code.trim().length > 0 && !isPending;

  // 初期化時のプリロードと最適化
  useEffect(() => {
    measurePerformance('initial-setup', () => {
      PerformanceMonitor.mark('page-init');
      
      // 重要なルートをプリロード
      preloadRoute("/explain");
      
      // 重いライブラリを遅延プリロード
      const preloadTimer = setTimeout(() => {
        // Syntax highlighter を background で準備
        import('react-syntax-highlighter').catch(() => {});
        // Markdown libraries を background で準備
        Promise.all([
          import('react-markdown').catch(() => {}),
          import('remark-gfm').catch(() => {})
        ]);
      }, 2000);

      // Service Worker の準備状況をチェック
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(() => {
          PerformanceMonitor.mark('sw-ready');
          // Service Worker にプリフェッチリクエスト
          navigator.serviceWorker.controller?.postMessage({
            type: 'PREFETCH',
            urls: ['/explain', '/api/review', '/api/chat']
          });
        });
      }

      PerformanceMonitor.measure('page-init-complete', 'page-init');
      
      return () => clearTimeout(preloadTimer);
    });

    // パフォーマンス報告（遅延）
    const reportTimer = setTimeout(() => {
      reportPerformance({
        initialRender: performance.now()
      });
    }, 5000);

    return () => clearTimeout(reportTimer);
  }, [measurePerformance, reportPerformance]);

  // GitHubコード読み込み（デデュープと最適化付き）
  const handleLoadGithub = useCallback(async (type: "url" | "company") => {
    const value = type === "url" ? githubUrl : companyPath;
    if (!value.trim()) return;

    trackInteraction(`github-load-${type}`);
    
    await measurePerformance(`github-load-${type}`, async () => {
      const requestKey = `github-${type}-${value.trim()}`;
      setLoadingGithub(true);
      setGithubError("");
      
      try {
        const data = await dedupeRequest(requestKey, async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト
          
          try {
            const res = await fetch("/api/github", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type, value: value.trim() }),
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!res.ok) {
              const errorData = await res.json();
              throw new Error(errorData.error ?? "読み込みに失敗しました");
            }
            
            return res.json();
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        });

        // UI更新をバッチ処理
        requestAnimationFrame(() => {
          setCode(data.code);
          if (data.detected_language && data.detected_language !== "その他") {
            setLanguage(data.detected_language);
          }
          setTab("paste");
        });
        
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : "ネットワークエラーが発生しました";
        setGithubError(errorMessage);
      } finally {
        setLoadingGithub(false);
      }
    });
  }, [githubUrl, companyPath, measurePerformance, trackInteraction]);

  // 解説ページへの遷移（最適化版）
  const handleSubmit = useCallback((mode: Mode) => {
    if (!canSubmit) return;
    
    trackInteraction(`submit-${mode}`);
    
    measurePerformance(`navigation-${mode}`, () => {
      // データを準備
      const requestData = { code, language, level, mode };
      
      startTransition(() => {
        // セッションストレージに保存（非同期）
        requestAnimationFrame(() => {
          sessionStorage.setItem("review-request", JSON.stringify(requestData));
        });
        
        // ページ遷移（即座に）
        router.push("/explain");
      });
    });
  }, [code, language, level, canSubmit, router, measurePerformance, trackInteraction]);

  // デバウンスされたイベントハンドラー（最適化）
  const debouncedCodeChange = useDebounce(useCallback((value: string) => {
    // 大きなテキストの処理を最適化
    if (value.length > 10000) {
      requestAnimationFrame(() => setCode(value));
    } else {
      setCode(value);
    }
  }, []), 150); // 150msに増加（重い処理用）

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    // 即座にUIを更新（小さなテキスト）
    if (value.length <= 1000) {
      setCode(value);
    }
    
    // デバウンスされた処理（大きなテキスト）
    debouncedCodeChange(value);
  }, [debouncedCodeChange]);

  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
    trackInteraction('language-change');
  }, [trackInteraction]);

  const handleLevelChange = useCallback((newLevel: Level) => {
    setLevel(newLevel);
    trackInteraction('level-change');
  }, [trackInteraction]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (tab === "github-url" && githubUrl.trim()) {
        handleLoadGithub("url");
      } else if (tab === "company" && companyPath.trim()) {
        handleLoadGithub("company");
      }
    }
  }, [tab, githubUrl, companyPath, handleLoadGithub]);

  // タブ切り替え（最適化）
  const handleTabChange = useCallback((newTab: Tab) => {
    setTab(newTab);
    setGithubError(""); // エラーをリセット
    trackInteraction(`tab-${newTab}`);
  }, [trackInteraction]);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <BookOpen className="w-7 h-7" style={{ color: "var(--accent-from)" }} />
          <div>
            <h1 className="text-xl font-bold gradient-text">code-review</h1>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              あなたのコードを、小学生にもわかる言葉で
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Tab selector */}
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: "var(--surface)" }}>
          {(
            [
              { key: "paste", label: "コードを貼り付け", icon: <BookOpen className="w-4 h-4" /> },
              { key: "github-url", label: "GitHub URL", icon: <GitBranch className="w-4 h-4" /> },
              { key: "company", label: "自社リポジトリ", icon: <FolderOpen className="w-4 h-4" /> },
            ] as { key: Tab; label: string; icon: React.ReactNode }[]
          ).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                tab === key
                  ? "gradient-bg text-white shadow-sm"
                  : "hover:opacity-70"
              )}
              style={tab !== key ? { color: "var(--muted)" } : {}}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* GitHub URL input */}
        {tab === "github-url" && (
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              GitHub ファイルURL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="github.com/owner/repo/blob/main/src/app/page.tsx"
                className="flex-1 px-3 py-2 rounded-lg border text-sm font-mono transition-colors focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
                onKeyDown={handleKeyDown}
                autoComplete="url"
              />
              <button
                onClick={() => handleLoadGithub("url")}
                disabled={!githubUrl.trim() || loadingGithub}
                className="px-4 py-2 rounded-lg gradient-bg text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-all hover:shadow-md disabled:hover:shadow-none"
              >
                {loadingGithub ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                読み込む
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              プライベートリポジトリは GITHUB_TOKEN 設定時にアクセス可能です
            </p>
            {githubError && (
              <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2 animate-in slide-in-from-top-2">
                {githubError}
              </div>
            )}
          </div>
        )}

        {/* Company repo path input */}
        {tab === "company" && (
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              自社リポジトリのファイルパス
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={companyPath}
                onChange={(e) => setCompanyPath(e.target.value)}
                placeholder="04_product/code-review/src/app/page.tsx"
                className="flex-1 px-3 py-2 rounded-lg border text-sm font-mono transition-colors focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
              <button
                onClick={() => handleLoadGithub("company")}
                disabled={!companyPath.trim() || loadingGithub}
                className="px-4 py-2 rounded-lg gradient-bg text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-all hover:shadow-md disabled:hover:shadow-none"
              >
                {loadingGithub ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                読み込む
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              takiguchi0706/company-context リポジトリのルートからの相対パス
            </p>
            {githubError && (
              <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2 animate-in slide-in-from-top-2">
                {githubError}
              </div>
            )}
          </div>
        )}

        {/* Code textarea */}
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            コード
            {code.trim().length > 0 && (
              <span className="ml-2 text-xs" style={{ color: "var(--muted)" }}>
                {code.split("\n").length} 行・{code.length.toLocaleString()} 文字
              </span>
            )}
          </label>
          <textarea
            value={code}
            onChange={handleCodeChange}
            placeholder="ここにコードを貼り付けてください..."
            rows={20}
            className="w-full px-4 py-3 rounded-lg border text-sm resize-y focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
              fontFamily: "var(--font-mono)",
              minHeight: "400px",
            }}
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        {/* Language + Level */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Language */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              言語
            </label>
            <select
              value={language}
              onChange={handleLanguageChange}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Level */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              解説レベル
            </label>
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: "elementary", label: "🧒 小学生向け", desc: "身近なたとえ、専門用語なし" },
                  { value: "middle", label: "🧑‍🎓 中高生向け", desc: "基本用語OK、丁寧に説明" },
                  { value: "engineer", label: "👨‍💻 エンジニア向け", desc: "設計・計算量まで深く" },
                ] as { value: Level; label: string; desc: string }[]
              ).map(({ value, label, desc }) => (
                <label
                  key={value}
                  className={clsx(
                    "flex items-start gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                    level === value ? "border-purple-500 ring-2 ring-purple-500/20" : "hover:border-purple-300"
                  )}
                  style={{
                    background: level === value ? "rgba(124,58,237,0.08)" : "var(--surface)",
                    borderColor: level === value ? "#7c3aed" : "var(--border)",
                  }}
                >
                  <input
                    type="radio"
                    name="level"
                    value={value}
                    checked={level === value}
                    onChange={() => handleLevelChange(value)}
                    className="mt-0.5 accent-purple-600"
                  />
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{label}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => handleSubmit("explain")}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-6 py-3 rounded-lg gradient-bg text-white font-medium disabled:opacity-50 transition-all hover:shadow-md disabled:hover:shadow-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
            解説する
          </button>
          <button
            onClick={() => handleSubmit("review")}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-6 py-3 rounded-lg border font-medium disabled:opacity-50 transition-all hover:shadow-md disabled:hover:shadow-none hover:bg-gray-50 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground)",
              background: "var(--surface)",
            }}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            レビューする
          </button>
        </div>

        {/* Performance indicators in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-2">
            <p>🔧 開発モード: パフォーマンス測定有効</p>
            <p>📊 コード行数: {code.split('\n').length.toLocaleString()}</p>
            <p>💾 キャッシュ有効範囲: GitHub API (5分), 静的リソース (1年)</p>
          </div>
        )}
      </main>
    </div>
  );
}