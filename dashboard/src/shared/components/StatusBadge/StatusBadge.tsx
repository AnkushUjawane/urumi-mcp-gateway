import type { ServerStatus } from "../../types";
import "./StatusBadge.css";

const LABEL: Record<ServerStatus, string> = {
  connected: "Connected",
  unreachable: "Unreachable",
  disabled: "Disabled",
  unknown: "Checking…",
};

export function StatusBadge({ status, reason }: { status: ServerStatus; reason?: string | null }) {
  return (
    <span className={`badge badge-${status}`} title={reason ?? undefined}>
      {LABEL[status] ?? status}
    </span>
  );
}
