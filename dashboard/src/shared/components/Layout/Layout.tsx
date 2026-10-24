import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");
  return (
    <div className="shell">
      <aside className="sidebar">
        <h1>Urumi Gateway</h1>
        <nav>
          <NavLink to="/servers" className={link}>Servers</NavLink>
          <NavLink to="/chat" className={link}>Chat</NavLink>
          <NavLink to="/keys" className={link}>API keys</NavLink>
          <NavLink to="/audit" className={link}>Audit log</NavLink>
          {user?.role === "admin" && <NavLink to="/members" className={link}>Members</NavLink>}
        </nav>
        <div className="who">
          <div>{user?.email}</div>
          <div className="muted">{user?.role}</div>
          <button onClick={async () => { await logout(); nav("/login"); }}>Log out</button>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
