import { useState } from "react";
import type { Member } from "../../shared/types";
import { MemberKeys } from "./MemberKeys";

type Props = {
  member: Member; isSelf: boolean;
  onToggleDisabled: () => void; onToggleRole: () => void; onChanged: () => void;
};

export function MemberRow({ member: m, isSelf, onToggleDisabled, onToggleRole, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className={m.disabled_at ? "dim" : ""}>
        <td>{m.email}{isSelf && <span className="muted"> (you)</span>}</td>
        <td>{m.role}</td>
        <td>{m.disabled_at ? "Disabled" : "Active"}</td>
        <td>{m.active_keys}</td>
        <td className="row-actions">
          <button className="secondary" onClick={() => setOpen(!open)}>{open ? "Hide keys" : "Keys"}</button>
          {!isSelf && (
            <>
              <button className="secondary" onClick={onToggleRole}>{m.role === "admin" ? "Make member" : "Make admin"}</button>
              <button className={m.disabled_at ? "secondary" : "danger"} onClick={onToggleDisabled}>
                {m.disabled_at ? "Enable" : "Disable"}
              </button>
            </>
          )}
        </td>
      </tr>
      {open && <tr><td colSpan={5}><MemberKeys userId={m.id} onChanged={onChanged} /></td></tr>}
    </>
  );
}
