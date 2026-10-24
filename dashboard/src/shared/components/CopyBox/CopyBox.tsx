import { useState } from "react";
import "./CopyBox.css";

export function CopyBox({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard blocked: the user can still select the text */ }
  }
  return (
    <div className="copybox">
      {label && <div className="muted small">{label}</div>}
      <div className="copybox-row">
        <input readOnly value={value} onFocus={(e) => e.target.select()} />
        <button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}
