import { NextRequest, NextResponse } from "next/server";
import { executeAgent } from "@/lib/agent-client";
import type { ExplainLevel } from "@/lib/system-prompts";

export const maxDuration = 60;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  code: string;
  language: string;
  level: ExplainLevel;
  question: string;
  history: ChatMessage[];
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const { code, language, level, question, history } = body;

  if (!question || question.trim().length === 0) {
    return NextResponse.json({ error: "質問が空です" }, { status: 400 });
  }

  const levelLabel =
    level === "elementary" ? "小学生向け" : level === "middle" ? "中高生向け" : "エンジニア向け";

  const system_prompt = `あなたはコードの解説を行うAIです。
以下の${language}コードについて、${levelLabel}のレベルで質問に回答してください。

コード：
\`\`\`${language}
${code}
\`\`\`

過去の解説・質問の文脈を踏まえて、簡潔かつわかりやすく回答してください。
Markdown形式で書いてください。`;

  // 会話履歴を instruction に組み込む
  const historyText = history
    .map((m) => `${m.role === "user" ? "質問" : "回答"}: ${m.content}`)
    .join("\n\n");

  const instruction = historyText
    ? `【これまでのQ&A】\n${historyText}\n\n【新しい質問】\n${question}`
    : question;

  try {
    const { result, usage } = await executeAgent({
      instruction,
      department: "04_product/code-review",
      system_prompt,
    });

    return NextResponse.json({
      answer: result,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: usage.cost_usd,
    });
  } catch (e) {
    console.error("chat API error:", e);
    return NextResponse.json(
      { error: "回答の生成に失敗しました。しばらく待ってから再試行してください。" },
      { status: 500 }
    );
  }
}
