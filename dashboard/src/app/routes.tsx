import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { Layout } from "../shared/components/Layout/Layout";
import { LoginPage } from "../features/auth/LoginPage";
import { AcceptInvitePage } from "../features/auth/AcceptInvitePage";
import { ServersPage } from "../features/servers/ServersPage";
import { MembersPage } from "../features/members/MembersPage";
import { KeysPage } from "../features/keys/KeysPage";
import { AuditPage } from "../features/audit/AuditPage";
import { ChatPage } from "../features/chat/ChatPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/servers" replace />} />
        <Route path="servers" element={<ServersPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="keys" element={<KeysPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="members" element={<ProtectedRoute adminOnly><MembersPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
