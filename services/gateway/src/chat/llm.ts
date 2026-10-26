import { config } from "../config.js";
import { getProviders, type Provider } from "./providers.js";

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolDef = { type: "function"; function: { name: string; description: string; parameters: any } };

export type LlmReply = {
  provider: string;
  model: string;
  message: { role: "assistant"; content: string | null; tool_calls?: ToolCall[] };
  finish_reason: string | null;
};

export class LlmError extends Error {
  constructor(public reason: string, public retryable: boolean) { super(reason); }
}

function mapStatus(status: number): LlmError {
  if (status === 401 || status === 403) return new LlmError("invalid API key", true);   // the other provider has its own key
  if (status === 404) return new LlmError("model not found", true);
  if (status === 429) return new LlmError("rate limited", true);
  if (status >= 500) return new LlmError(`provider error (${status})`, true);
  return new LlmError(`request rejected (${status})`, false);                            // our request is wrong; retrying elsewhere hides the bug
}

async function callProvider(p: Provider, messages: ChatMessage[], tools: ToolDef[]): Promise<LlmReply> {
  let res: Response;
  try {
    res = await fetch(`${p.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({
        model: p.model,
        messages,
        ...(tools.length ? { tools, tool_choice: "auto" } : {}),
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(config.LLM_TIMEOUT_MS),
    });
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") throw new LlmError("timeout", true);
    throw new LlmError(`network error (${e?.cause?.code ?? "unknown"})`, true);
  }
  if (!res.ok) {
    // Log the status only. The body can echo prompt content, so we never log it.
    console.warn(`llm ${p.name}: HTTP ${res.status}`);
    if (res.status === 400) console.warn(`llm ${p.name} 400 body: ${(await res.text()).slice(0, 300)}`);
    throw mapStatus(res.status);
  }
  const data: any = await res.json().catch(() => null);
  const choice = data?.choices?.[0];
  if (!choice?.message) throw new LlmError("malformed response", true);
  return {
    provider: p.name,
    model: p.model,
    message: {
      role: "assistant",
      content: choice.message.content ?? null,
      tool_calls: choice.message.tool_calls?.length ? choice.message.tool_calls : undefined,
    },
    finish_reason: choice.finish_reason ?? null,
  };
}

// Tries each configured provider in order (primary, then fallback).
export async function chatCompletion(messages: ChatMessage[], tools: ToolDef[], pin?: string): Promise<LlmReply> {
  const all = getProviders();
  const providers = pin ? all.filter((p) => p.name === pin) : all;   // once a provider answers, stick with it
  if (providers.length === 0) throw new LlmError("no LLM provider configured", false);
  const failures: string[] = [];
  for (const p of providers) {
    try {
      return await callProvider(p, messages, tools);
    } catch (e) {
      const err = e instanceof LlmError ? e : new LlmError("unexpected error", false);
      failures.push(`${p.name}: ${err.reason}`);
      console.warn(`llm ${p.name} failed: ${err.reason}${err.retryable ? " (trying next)" : ""}`);
      if (!err.retryable) break;
    }
  }
  throw new LlmError(`All LLM providers failed (${failures.join("; ")})`, false);
}
