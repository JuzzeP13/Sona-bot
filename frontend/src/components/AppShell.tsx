import { BarChart3, ClipboardList, LogOut, Users } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "../lib/api";

type NavItem = {
  label: string;
  to: string;
  icon: ReactNode;
};

type Props = {
  title: string;
  role: "admin" | "manager";
  children: ReactNode;
};

export function AppShell({ title, role, children }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: api.logout,
    onSettled: async () => {
      await queryClient.clear();
      navigate("/login", { replace: true });
    }
  });

  const navItems: NavItem[] =
    role === "admin"
      ? [
          { label: "Dashboard", to: "/admin/dashboard", icon: <BarChart3 className="h-4 w-4" /> },
          { label: "Заявки", to: "/admin/leads", icon: <ClipboardList className="h-4 w-4" /> },
          { label: "Менеджеры", to: "/admin/managers", icon: <Users className="h-4 w-4" /> }
        ]
      : [{ label: "Мои заявки", to: "/manager/leads", icon: <ClipboardList className="h-4 w-4" /> }];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-800 bg-slate-950/90 px-4 py-5 md:block">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-leaf">Sofa CRM</p>
          <h1 className="mt-1 text-xl font-bold">{title}</h1>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                  isActive ? "bg-leaf text-white" : "text-slate-300 hover:bg-slate-800"
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="absolute bottom-5 left-4 right-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </button>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="mb-3 flex items-center justify-between">
            <strong>{title}</strong>
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800"
              aria-label="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                    isActive ? "bg-leaf text-white" : "bg-slate-800 text-slate-300"
                  )
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
