import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./contexts/AuthContext";
import AppLayout from "./layouts/AppLayout";
import { Login, Register, Forgot, ResetPassword } from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inspect from "./pages/Inspect";
import Batch from "./pages/Batch";
import Defects from "./pages/Defects";
import Products from "./pages/Products";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import Assistant from "./pages/Assistant";
import Employees from "./pages/Employees";
import Settings from "./pages/Settings";
import type { Role } from "./types";
import { Skeleton } from "./components/ui";

function Guard({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { session, profile, loading, can } = useAuth();
  if (loading) return <div className="space-y-4 p-8"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <p className="p-8 text-sm text-bad">Profile not found. Ask an admin to check your account.</p>;
  if (!profile.is_active) return <p className="p-8 text-sm text-bad">This account is deactivated.</p>;
  if (roles && !can(...roles)) return <p className="p-8 text-sm text-mute">You do not have permission to view this page.</p>;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/reset" element={<ResetPassword />} />
      <Route element={<Guard><AppLayout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="inspect" element={<Guard roles={["super_admin", "admin", "inspector"]}><Inspect /></Guard>} />
        <Route path="batch" element={<Guard roles={["super_admin", "admin", "inspector"]}><Batch /></Guard>} />
        <Route path="defects" element={<Defects />} />
        <Route path="products" element={<Products />} />
        <Route path="history" element={<History />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="reports" element={<Reports />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="employees" element={<Guard roles={["super_admin", "admin"]}><Employees /></Guard>} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
