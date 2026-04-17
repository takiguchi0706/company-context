import { NextRequest, NextResponse } from "next/server";
import { executeAgent } from "@/lib/agent-client";
import { buildSystemPrompt, type ExplainLevel, type ReviewMode } from "@/lib/system-prompts";
import { globalCache } from "@/lib/performance";

export const maxDuration = 60;

interface ReviewRequest {
  code: string;
  language: string;
  level: ExplainLevel;
  mode: ReviewMode;
}

// ストリーミングレスポンス用のヘルパー
function createStreamingResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    }
  });

  const write = (data: any) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  const close = () => {
    controller.close();
  };

  return { stream, write, close };
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

  // Accept ヘッダーをチェックしてストリーミングを判定
  const acceptsStream = req.headers.get('accept')?.includes('text/event-stream');

  // キャッシュキーの生成（ハッシュ化でメモリ効率化）
  const cacheKey = `review-${btoa(code.slice(0, 200) + language + level + mode).slice(0, 50)}`;
  
  // キャッシュから確認（10分間有効）
  const cached = globalCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 600000) {
    console.log('🚀 Cache hit for review request');
    return NextResponse.json({
      explanation: cached.explanation,
      input_tokens: cached.input_tokens,
      output_tokens: cached.output_tokens,
      cost_usd: cached.cost_usd,
      elapsed_ms: cached.elapsed_ms,
      cached: true,
    });
  }

  const system_prompt = buildSystemPrompt(mode, level);
  const instruction = `以下の${language}コードを${mode === "explain" ? "解説" : "レビュー"}してください：

\`\`\`${language}
${code}
\`\`\``;

  const startTime = Date.now();

  // ストリーミングレスポンス
  if (acceptsStream) {
    const { stream, write, close } = createStreamingResponse();

    // 非同期でAI処理を実行
    (async () => {
      try {
        // 進捗状況を送信
        write({ type: 'progress', message: 'AI解説を生成中...', progress: 0 });

        const { result, usage } = await executeAgent({
          instruction,
          department: "04_product/code-review",
          system_prompt,
        });

        const elapsed_ms = Date.now() - startTime;

        // 結果をキャッシュ
        const cacheData = {
          explanation: result,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cost_usd: usage.cost_usd,
          elapsed_ms,
          timestamp: Date.now(),
        };
        globalCache.set(cacheKey, cacheData);

        // 完了データを送信
        write({
          type: 'complete',
          explanation: result,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cost_usd: usage.cost_usd,
          elapsed_ms,
        });

      } catch (e) {
        console.error("review API error:", e);
        write({
          type: 'error',
          error: "AI解説の生成に失敗しました。しばらく待ってから再試行してください。"
        });
      } finally {
        close();
      }
    })();

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });
  }

  // 通常のレスポンス（非ストリーミング）
  try {
    const { result, usage } = await executeAgent({
      instruction,
      department: "04_product/code-review",
      system_prompt,
    });

    const elapsed_ms = Date.now() - startTime;

    // 結果をキャッシュ
    const cacheData = {
      explanation: result,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: usage.cost_usd,
      elapsed_ms,
      timestamp: Date.now(),
    };
    globalCache.set(cacheKey, cacheData);

    return NextResponse.json({
      explanation: result,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: usage.cost_usd,
      elapsed_ms,
    });
  } catch (e) {
    console.error("review API error:", e);
    return NextResponse.json(
      { error: "AI解説の生成に失敗しました。しばらく待ってから再試行してください。" },
      { status: 500 }
    );
  }
}