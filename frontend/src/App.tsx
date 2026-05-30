import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from "react-router-dom";
import { api } from "./lib/api";
import { AppShell } from "./components/AppShell";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminLeadsPage } from "./pages/AdminLeadsPage";
import { AdminManagersPage } from "./pages/AdminManagersPage";
import { LoginPage } from "./pages/LoginPage";
import { ManagerLeadsPage } from "./pages/ManagerLeadsPage";
import { SofaBotPage } from "./pages/SofaBotPage";
import type { UserRole } from "./types/api";

function RequireAuth({ roles }: { roles: UserRole[] }) {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false
  });

  if (me.isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-paper text-slate-300">Загрузка...</div>;
  }

  if (me.isError || !me.data) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(me.data.user.role)) {
    return <Navigate to={me.data.user.role === "admin" ? "/admin/dashboard" : "/manager/leads"} replace />;
  }

  return <Outlet />;
}

function AdminLayout() {
  return (
    <AppShell title="Руководство" role="admin">
      <Outlet />
    </AppShell>
  );
}

function ManagerLayout() {
  return (
    <AppShell title="Менеджер" role="manager">
      <Outlet />
    </AppShell>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "/sofa-bot", element: <SofaBotPage /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth roles={["admin"]} />,
    children: [
      {
        path: "/admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: "dashboard", element: <AdminDashboardPage /> },
          { path: "leads", element: <AdminLeadsPage /> },
          { path: "managers", element: <AdminManagersPage /> }
        ]
      }
    ]
  },
  {
    element: <RequireAuth roles={["manager"]} />,
    children: [
      {
        path: "/manager",
        element: <ManagerLayout />,
        children: [
          { index: true, element: <Navigate to="/manager/leads" replace /> },
          { path: "leads", element: <ManagerLeadsPage /> }
        ]
      }
    ]
  },
  { path: "*", element: <Navigate to="/login" replace /> }
]);

export function App() {
  return <RouterProvider router={router} />;
}
