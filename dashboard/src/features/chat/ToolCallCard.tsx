import type { ToolStep } from "../../shared/types";

const ICON = { running: "⏳", ok: "✔", error: "✖" } as const;

export function ToolCallCard({ step }: { step: ToolStep }) {
  // Arguments come from the model and the preview from an upstream server: both are untrusted, rendered as text only.
  const args = JSON.stringify(step.args);
  return (
    <details className={`toolcard toolcard-${step.status}`}>
      <summary>
        <span aria-hidden>{ICON[step.status]}</span> <code>{step.name}</code>
        <span className="muted small"> {args.length > 80 ? args.slice(0, 80) + "…" : args}</span>
      </summary>
      <div className="toolcard-body">
        <div className="muted small">Arguments</div>
        <pre>{JSON.stringify(step.args, null, 2)}</pre>
        <div className="muted small">{step.status === "running" ? "Waiting for the result…" : "Result (first 500 characters)"}</div>
        {step.preview !== undefined && <pre>{step.preview}</pre>}
      </div>
    </details>
  );
}
