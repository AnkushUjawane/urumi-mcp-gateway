import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatEvent, UiMessage } from "../../shared/types";
import { chatStatus, streamChat, type ChatStatus } from "./chat.api";
import { MessageList } from "./MessageList";
import "./chat.css";

const SUGGESTIONS = [
  "What orders came in today?",
  "Create a product called Demo Mug priced 150",
  "List the products in the store",
  "Save a note titled Standup with a one-line summary of today's orders",
];

export function ChatPage() {
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => { chatStatus().then(setStatus).catch(() => setStatus({ enabled: false, providers: [] })); }, []);
  useEffect(() => () => abort.current?.abort(), []);   // leaving the page stops the stream

  // Update the newest message (the assistant message being streamed).
  const patchLast = (fn: (m: UiMessage) => UiMessage) =>
    setMessages((prev) => { const c = [...prev]; c[c.length - 1] = fn(c[c.length - 1]); return c; });

  function apply(e: ChatEvent) {
    patchLast((m) => {
      switch (e.type) {
        case "tool_call":
          return { ...m, steps: [...m.steps, { id: e.id, name: e.name, args: e.args, status: "running" }] };
        case "tool_result":
          return { ...m, steps: m.steps.map((s) => s.id === e.id ? { ...s, status: e.isError ? "error" : "ok", preview: e.preview } : s) };
        case "text": return { ...m, text: e.text, provider: e.provider };
        case "error": return { ...m, error: e.message };
        default: return m;
      }
    });
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;

    // The gateway stores nothing, so we send the conversation each time: user messages and final answers only.
    const history = messages
      .filter((m) => m.text)
      .map((m) => ({ role: m.role, content: m.text }))
      .slice(-19);
    const payload = [...history, { role: "user", content: q }];

    setMessages((prev) => [
      ...prev,
      { id: nextId.current++, role: "user", text: q, steps: [] },
      { id: nextId.current++, role: "assistant", text: "", steps: [], streaming: true },
    ]);
    setInput(""); setBusy(true);
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      await streamChat(payload, apply, ctl.signal);
    } catch (err) {
      patchLast((m) => ({ ...m, error: err instanceof Error ? err.message : "Chat failed" }));
    } finally {
      // Any card still "running" never got a result (stopped or interrupted).
      patchLast((m) => ({
        ...m, streaming: false,
        steps: m.steps.map((s) => s.status === "running" ? { ...s, status: "error", preview: "No result received (stopped or interrupted)." } : s),
      }));
      setBusy(false);
      abort.current = null;
    }
  }

  const submit = (e: FormEvent) => { e.preventDefault(); ask(input); };

  return (
    <div className="chat">
      <div className="page-head">
        <h2>Chat</h2>
        <button className="secondary" disabled={busy || messages.length === 0} onClick={() => setMessages([])}>New chat</button>
      </div>
      <p className="muted">
        The assistant answers with the same tools as your MCP client. Every tool call is made as you and appears in the audit log.
        This chat is not saved: reloading the page clears it.
      </p>
      {status && !status.enabled && (
        <p className="error" role="alert">Chat is not configured: the gateway has no LLM key. Ask an admin to run scripts/set-llm-keys.sh.</p>
      )}

      {messages.length === 0 ? (
        <div className="suggestions">
          <div className="muted small">Try:</div>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="secondary" disabled={busy || status?.enabled === false} onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      ) : <MessageList messages={messages} />}

      <form className="composer" onSubmit={submit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about orders, products, notes…"
               maxLength={2000} disabled={busy || status?.enabled === false} autoFocus />
        {busy
          ? <button type="button" className="danger" onClick={() => abort.current?.abort()}>Stop</button>
          : <button type="submit" disabled={!input.trim() || status?.enabled === false}>Send</button>}
      </form>
    </div>
  );
}
