import { api, ApiError } from "../../shared/api/client";
import type { ChatEvent } from "../../shared/types";

export type ChatStatus = { enabled: boolean; providers: { name: string; model: string; role: string }[] };
export const chatStatus = () => api<ChatStatus>("/api/chat/status");

// Reads the server-sent events from POST /api/chat and calls onEvent for each one.
export async function streamChat(
  messages: { role: string; content: string }[],
  onEvent: (e: ChatEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch {
    if (signal.aborted) return;
    throw new ApiError(0, "Cannot reach the server. Check your connection.");
  }
  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error ?? msg; } catch { /* not JSON */ }
    throw new ApiError(res.status, msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // Events are separated by a blank line. Lines starting with ":" are keep-alive comments.
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        for (const line of block.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try { onEvent(JSON.parse(line.slice(6)) as ChatEvent); } catch { /* ignore a malformed event */ }
        }
      }
    }
  } catch {
    if (!signal.aborted) throw new ApiError(0, "The connection was interrupted.");
  }
}
