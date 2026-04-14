const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL;

if (!AGENT_SERVER_URL) {
  console.warn("AGENT_SERVER_URL is not set");
}

export interface AgentUsage {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface AgentResult {
  result: string;
  usage: AgentUsage;
}

export async function executeAgent(params: {
  instruction: string;
  department: string;
  system_prompt?: string;
}): Promise<AgentResult> {
  const url = `${AGENT_SERVER_URL}/execute-agent`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`agent-server error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    success: boolean;
    result: string;
    usage: AgentUsage;
  };

  if (!data.success) {
    throw new Error("agent-server returned success=false");
  }

  return { result: data.result, usage: data.usage };
}
