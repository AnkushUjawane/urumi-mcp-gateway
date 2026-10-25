import { useRef, useState } from "react";
import "./CopyBox.css";

export function CopyBox({ value, label }: { value: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const input = useRef<HTMLInputElement>(null);

  async function copy() {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch { /* fall through to the fallback */ }

    if (!ok) {
      input.current?.focus();
      input.current?.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
    }
    setState(ok ? "copied" : "failed");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="copybox">
      {label && <div className="muted small">{label}</div>}
      <div className="copybox-row">
        <input ref={input} readOnly value={value} onFocus={(e) => e.target.select()} />
        <button type="button" onClick={copy}>
          {state === "copied" ? "Copied" : state === "failed" ? "Press Ctrl+C" : "Copy"}
        </button>
      </div>
    </div>
  );
}
