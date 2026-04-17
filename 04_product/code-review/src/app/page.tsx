"use client";

import { useState, useCallback, useTransition, startTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, GitBranch, FolderOpen, Loader2, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { preloadRoute } from "@/lib/performance";

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

  const [tab, setTab] = useState<Tab>("paste");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("TypeScript");
  const [level, setLevel] = useState<Level>("elementary");
  const [githubUrl, setGithubUrl] = useState("");
  const [companyPath, setCompanyPath] = useState("");
  const [loadingGithub, setLoadingGithub] = useState(false);
  const [githubError, setGithubError] = useState("");

  const canSubmit = code.trim().length > 0 && !isPending;

  // 説明ページのプリロード
  useState(() => {
    preloadRoute("/explain");
  });

  const handleLoadGithub = useCallback(async (type: "url" | "company") => {
    const value = type === "url" ? githubUrl : companyPath;
    if (!value.trim()) return;

    setLoadingGithub(true);
    setGithubError("");
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGithubError(data.error ?? "読み込みに失敗しました");
        return;
      }
      setCode(data.code);
      if (data.detected_language && data.detected_language !== "その他") {
        setLanguage(data.detected_language);
      }
      setTab("paste");
    } catch {
      setGithubError("ネットワークエラーが発生しました");
    } finally {
      setLoadingGithub(false);
    }
  }, [githubUrl, companyPath]);

  const handleSubmit = useCallback((mode: Mode) => {
    if (!canSubmit) return;
    
    startTransition(() => {
      sessionStorage.setItem(
        "review-request",
        JSON.stringify({ code, language, level, mode })
      );
      router.push("/explain");
    });
  }, [code, language, level, canSubmit, router]);

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
  }, []);

  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  }, []);

  const handleLevelChange = useCallback((newLevel: Level) => {
    setLevel(newLevel);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (tab === "github-url" && githubUrl.trim()) {
        handleLoadGithub("url");
      } else if (tab === "company" && companyPath.trim()) {
        handleLoadGithub("company");
      }
    }
  }, [tab, githubUrl, companyPath, handleLoadGithub]);

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
              onClick={() => setTab(key)}
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
                className="flex-1 px-3 py-2 rounded-lg border text-sm font-mono"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={() => handleLoadGithub("url")}
                disabled={!githubUrl.trim() || loadingGithub}
                className="px-4 py-2 rounded-lg gradient-bg text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {loadingGithub ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                読み込む
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              プライベートリポジトリは GITHUB_TOKEN 設定時にアクセス可能です
            </p>
            {githubError && (
              <p className="text-sm text-red-500">{githubError}</p>
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
                className="flex-1 px-3 py-2 rounded-lg border text-sm font-mono"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={() => handleLoadGithub("company")}
                disabled={!companyPath.trim() || loadingGithub}
                className="px-4 py-2 rounded-lg gradient-bg text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {loadingGithub ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                読み込む
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              takiguchi0706/company-context リポジトリのルートからの相対パス
            </p>
            {githubError && (
              <p className="text-sm text-red-500">{githubError}</p>
            )}
          </div>
        )}

        {/* Code textarea */}
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            コード
            {code.trim().length > 0 && (
              <span className="ml-2 text-xs" style={{ color: "var(--muted)" }}>
                {code.split("\n").length} 行
              </span>
            )}
          </label>
          <textarea
            value={code}
            onChange={handleCodeChange}
            placeholder="ここにコードを貼り付けてください..."
            rows={20}
            className="w-full px-4 py-3 rounded-lg border text-sm resize-y"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
              fontFamily: "var(--font-mono)",
            }}
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
              className="w-full px-3 py-2 rounded-lg border text-sm"
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
                    "flex items-start gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all",
                    level === value ? "border-purple-500" : ""
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
                    className="mt-0.5"
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
            className="flex items-center gap-2 px-6 py-3 rounded-lg gradient-bg text-white font-medium disabled:opacity-50 transition-opacity"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
            解説する
          </button>
          <button
            onClick={() => handleSubmit("review")}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-6 py-3 rounded-lg border font-medium disabled:opacity-50 transition-opacity"
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
      </main>
    </div>
  );
}