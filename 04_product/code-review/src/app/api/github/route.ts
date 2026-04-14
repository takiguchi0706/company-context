import { NextRequest, NextResponse } from "next/server";
import { executeAgent } from "@/lib/agent-client";

export const maxDuration = 30;

const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  py: "Python",
  go: "Go",
  rs: "Rust",
  java: "Java",
  cpp: "C++",
  cc: "C++",
  cxx: "C++",
  php: "PHP",
  rb: "Ruby",
};

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANGUAGE[ext] ?? "その他";
}

/**
 * github.com/owner/repo/blob/branch/path/to/file.ts
 * → { owner, repo, branch, path, filename }
 */
function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string; filePath: string; filename: string } | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    if (!u.hostname.includes("github.com") && !u.hostname.includes("raw.githubusercontent.com")) {
      return null;
    }

    // raw.githubusercontent.com/owner/repo/branch/path
    if (u.hostname === "raw.githubusercontent.com") {
      const parts = u.pathname.slice(1).split("/");
      if (parts.length < 4) return null;
      const [owner, repo, branch, ...rest] = parts;
      const filePath = rest.join("/");
      return { owner, repo, branch, filePath, filename: rest[rest.length - 1] };
    }

    // github.com/owner/repo/blob/branch/path
    const parts = u.pathname.slice(1).split("/");
    if (parts.length < 5 || parts[2] !== "blob") return null;
    const [owner, repo, , branch, ...rest] = parts;
    const filePath = rest.join("/");
    return { owner, repo, branch, filePath, filename: rest[rest.length - 1] };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: { type: "url" | "company"; value: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const { type, value } = body;

  if (!value || value.trim().length === 0) {
    return NextResponse.json({ error: "URLまたはパスが空です" }, { status: 400 });
  }

  // ── 自社リポジトリパス（agent-server経由）──────────────────────────────
  if (type === "company") {
    try {
      const { result } = await executeAgent({
        instruction: `以下のファイルを読み込んで、その内容をそのまま出力してください（説明不要）：\n${value}`,
        department: "04_product/code-review",
        system_prompt: "ファイルの内容をそのまま出力してください。説明や解説は不要です。",
      });

      const filename = value.split("/").pop() ?? "file";
      return NextResponse.json({
        code: result,
        filename,
        detected_language: detectLanguage(filename),
      });
    } catch (e) {
      console.error("company file read error:", e);
      return NextResponse.json(
        { error: "自社リポジトリのファイル読み込みに失敗しました" },
        { status: 500 }
      );
    }
  }

  // ── GitHub URL ────────────────────────────────────────────────────────────
  const parsed = parseGitHubUrl(value.trim());
  if (!parsed) {
    return NextResponse.json(
      { error: "GitHub URLの形式が不正です。例: github.com/owner/repo/blob/main/path/to/file.ts" },
      { status: 400 }
    );
  }

  const { owner, repo, branch, filePath, filename } = parsed;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "code-review-app",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(apiUrl, { headers });

    if (res.status === 404) {
      return NextResponse.json(
        { error: "ファイルが見つかりません。URLとブランチ名を確認してください。" },
        { status: 404 }
      );
    }

    if (res.status === 403 || res.status === 401) {
      return NextResponse.json(
        {
          error: token
            ? "アクセス権限がありません。GitHubトークンに repo 権限があるか確認してください。"
            : "プライベートリポジトリにアクセスするには GITHUB_TOKEN の設定が必要です。",
        },
        { status: 403 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub APIエラー: ${res.status} ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as { content?: string; encoding?: string; type?: string };

    if (data.type === "dir") {
      return NextResponse.json(
        { error: "指定されたパスはディレクトリです。ファイルのURLを指定してください。" },
        { status: 400 }
      );
    }

    if (!data.content || data.encoding !== "base64") {
      return NextResponse.json(
        { error: "ファイルの内容を取得できませんでした。" },
        { status: 500 }
      );
    }

    const code = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");

    return NextResponse.json({
      code,
      filename,
      detected_language: detectLanguage(filename),
    });
  } catch (e) {
    console.error("GitHub fetch error:", e);
    return NextResponse.json(
      { error: "GitHubからのファイル取得に失敗しました。" },
      { status: 500 }
    );
  }
}
