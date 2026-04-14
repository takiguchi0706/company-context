import { NextRequest, NextResponse } from "next/server";
import { executeAgent } from "@/lib/agent-client";
import { buildSystemPrompt, type ExplainLevel, type ReviewMode } from "@/lib/system-prompts";

export const maxDuration = 60;

interface ReviewRequest {
  code: string;
  language: string;
  level: ExplainLevel;
  mode: ReviewMode;
}

export async function POST(req: NextRequest) {
  let body: ReviewRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const { code, language, level, mode } = body;

  if (!code || code.trim().length === 0) {
    return NextResponse.json({ error: "コードが空です" }, { status: 400 });
  }

  const system_prompt = buildSystemPrompt(mode, level);
  const instruction = `以下の${language}コードを${mode === "explain" ? "解説" : "レビュー"}してください：

\`\`\`${language}
${code}
\`\`\``;

  const startTime = Date.now();

  try {
    const { result, usage } = await executeAgent({
      instruction,
      department: "04_product/code-review",
      system_prompt,
    });

    return NextResponse.json({
      explanation: result,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: usage.cost_usd,
      elapsed_ms: Date.now() - startTime,
    });
  } catch (e) {
    console.error("review API error:", e);
    return NextResponse.json(
      { error: "AI解説の生成に失敗しました。しばらく待ってから再試行してください。" },
      { status: 500 }
    );
  }
}
