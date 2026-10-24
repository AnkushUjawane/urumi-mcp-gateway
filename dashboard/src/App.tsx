import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./app/AuthContext";
import { AppRoutes } from "./app/routes";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
