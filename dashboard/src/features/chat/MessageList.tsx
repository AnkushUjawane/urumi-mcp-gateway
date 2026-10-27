import { useEffect, useRef } from "react";
import type { UiMessage } from "../../shared/types";
import { ToolCallCard } from "./ToolCallCard";

export function MessageList({ messages }: { messages: UiMessage[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <div className="messages">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="bubble user">{m.text}</div>
        ) : (
          <div key={m.id} className="assistant">
            {m.steps.map((s) => <ToolCallCard key={s.id} step={s} />)}
            {m.text && (
              <div className="bubble bot">
                {m.text}
                {m.provider && <div className="muted small">answered by {m.provider}</div>}
              </div>
            )}
            {m.streaming && !m.text && !m.error && <div className="muted small">Thinking…</div>}
            {m.error && <div className="error" role="alert">{m.error}</div>}
          </div>
        ),
      )}
      <div ref={end} />
    </div>
  );
}
