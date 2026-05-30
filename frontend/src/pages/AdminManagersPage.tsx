import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { api, ApiError } from "../lib/api";

export function AdminManagersPage() {
  const queryClient = useQueryClient();
  const managers = useQuery({
    queryKey: ["managers"],
    queryFn: api.managers
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [error, setError] = useState("");
  const [passwords, setPasswords] = useState<Record<string, string>>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["managers"] });

  const create = useMutation({
    mutationFn: () => api.createManager({ name, email, password, telegramChatId }),
    onSuccess: async () => {
      setName("");
      setEmail("");
      setPassword("");
      setTelegramChatId("");
      setError("");
      await invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось создать менеджера")
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.activateManager(id),
    onSuccess: invalidate
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.deactivateManager(id),
    onSuccess: invalidate
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, nextPassword }: { id: string; nextPassword: string }) => api.updateManagerPassword(id, nextPassword),
    onSuccess: async (_data, variables) => {
      setPasswords((current) => ({ ...current, [variables.id]: "" }));
      await invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось сменить пароль")
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Менеджеры</h1>
        <p className="mt-1 text-sm text-slate-400">Создание, отключение и статистика менеджеров.</p>
      </div>

      <form onSubmit={onSubmit} className="panel p-4">
        <h2 className="mb-3 font-semibold">Создать менеджера</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <input className="field" placeholder="Имя" value={name} onChange={(event) => setName(event.target.value)} required />
          <input className="field" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <input
            className="field"
            type="password"
            placeholder="Пароль от 8 символов"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          <input
            className="field"
            placeholder="Telegram chat id"
            value={telegramChatId}
            onChange={(event) => setTelegramChatId(event.target.value)}
          />
        </div>
        {error && <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</div>}
        <button type="submit" className="btn-primary mt-3" disabled={create.isPending}>
          Создать
        </button>
      </form>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Имя</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Telegram</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Заявок</th>
                <th className="px-4 py-3">Успешно</th>
                <th className="px-4 py-3">Конверсия</th>
                <th className="px-4 py-3">Пароль</th>
                <th className="px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {managers.data?.managers.map((manager) => (
                <tr key={manager.id}>
                  <td className="px-4 py-3 font-medium">{manager.name}</td>
                  <td className="px-4 py-3">{manager.email}</td>
                  <td className="px-4 py-3">{manager.telegramChatId || "—"}</td>
                  <td className="px-4 py-3">{manager.isActive ? "Активен" : "Отключён"}</td>
                  <td className="px-4 py-3">{manager.stats?.totalAssigned ?? 0}</td>
                  <td className="px-4 py-3">{manager.stats?.success ?? 0}</td>
                  <td className="px-4 py-3">{manager.stats?.conversion ?? 0}%</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <input
                        className="field w-48"
                        type="password"
                        placeholder="Новый пароль"
                        value={passwords[manager.id] ?? ""}
                        onChange={(event) => setPasswords((current) => ({ ...current, [manager.id]: event.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => resetPassword.mutate({ id: manager.id, nextPassword: passwords[manager.id] ?? "" })}
                        disabled={(passwords[manager.id] ?? "").length < 8}
                      >
                        Сменить
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {manager.isActive ? (
                      <button type="button" className="btn-secondary" onClick={() => deactivate.mutate(manager.id)}>
                        Отключить
                      </button>
                    ) : (
                      <button type="button" className="btn-primary" onClick={() => activate.mutate(manager.id)}>
                        Включить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!managers.isLoading && !managers.data?.managers.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Менеджеров пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
