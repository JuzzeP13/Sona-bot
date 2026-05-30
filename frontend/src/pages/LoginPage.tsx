import { LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: () => api.login(email, password),
    onSuccess: async ({ user }) => {
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate(user.role === "admin" ? "/admin/dashboard" : "/manager/leads", { replace: true });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Не удалось войти");
    }
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form onSubmit={onSubmit} className="panel w-full max-w-sm p-6">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase text-leaf">Sofa CRM</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">Вход</h1>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Email</span>
          <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>

        <label className="mb-5 block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Пароль</span>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error && <div className="mb-4 rounded-md border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</div>}

        <button type="submit" className="btn-primary w-full gap-2" disabled={login.isPending}>
          <LogIn className="h-4 w-4" />
          Войти
        </button>
      </form>
    </main>
  );
}
