import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatDate, SOFA_MODELS, SOFA_MODEL_LABELS, STATUS_OPTIONS } from "../lib/constants";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import type { LeadStatus, SofaLead, SofaModel } from "../types/api";

export function AdminLeadsPage() {
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [model, setModel] = useState<SofaModel | "">("");
  const [managerId, setManagerId] = useState("");
  const [search, setSearch] = useState("");
  const [onlyNew, setOnlyNew] = useState(false);
  const [unassigned, setUnassigned] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const leads = useQuery({
    queryKey: ["adminLeads", status, model, managerId, search, onlyNew, unassigned],
    queryFn: () =>
      api.adminLeads({
        status: status || undefined,
        model: model || undefined,
        managerId: managerId || undefined,
        search,
        onlyNew,
        unassigned
      })
  });

  const managers = useQuery({
    queryKey: ["managers"],
    queryFn: api.managers
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Заявки</h1>
        <p className="mt-1 text-sm text-slate-400">Все заявки с фильтрами, назначением менеджеров и историей действий.</p>
      </div>

      <section className="panel p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input className="field" placeholder="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="field" value={status} onChange={(event) => setStatus(event.target.value as LeadStatus | "")}>
            <option value="">Все статусы</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="field" value={model} onChange={(event) => setModel(event.target.value as SofaModel | "")}>
            <option value="">Все модели</option>
            {SOFA_MODELS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select className="field" value={managerId} onChange={(event) => setManagerId(event.target.value)}>
            <option value="">Все менеджеры</option>
            {managers.data?.managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
            <input type="checkbox" checked={onlyNew} onChange={(event) => setOnlyNew(event.target.checked)} />
            Только новые
          </label>
          <label className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
            <input type="checkbox" checked={unassigned} onChange={(event) => setUnassigned(event.target.checked)} />
            Без менеджера
          </label>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-sm text-slate-400">
          Найдено: <strong>{leads.data?.total ?? 0}</strong>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Модель</th>
                <th className="px-4 py-3">Телефон</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Менеджер</th>
                <th className="px-4 py-3">Источник</th>
                <th className="px-4 py-3">Комментарий</th>
                <th className="px-4 py-3">Обновлено</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {leads.data?.leads.map((lead) => (
                <tr key={lead.id} className="cursor-pointer hover:bg-slate-800/60" onClick={() => setSelectedLeadId(lead.id)}>
                  <td className="px-4 py-3">{formatDate(lead.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{SOFA_MODEL_LABELS[lead.selectedModel]}</td>
                  <td className="px-4 py-3">
                    {lead.phone}
                    {Boolean(lead.duplicateCount) && (
                      <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-200">ещё {lead.duplicateCount}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3">{lead.assignedManager?.name ?? "Не назначен"}</td>
                  <td className="px-4 py-3">{lead.source}</td>
                  <td className="max-w-[220px] truncate px-4 py-3">{lead.adminComment || lead.managerComment || "—"}</td>
                  <td className="px-4 py-3">{formatDate(lead.updatedAt)}</td>
                </tr>
              ))}
              {!leads.isLoading && !leads.data?.leads.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Заявок пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedLeadId && (
        <AdminLeadModal leadId={selectedLeadId} managers={managers.data?.managers ?? []} onClose={() => setSelectedLeadId(null)} />
      )}
    </div>
  );
}

function AdminLeadModal({ leadId, managers, onClose }: { leadId: string; managers: Array<{ id: string; name: string }>; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LeadStatus>("new");
  const [managerId, setManagerId] = useState("");
  const [adminComment, setAdminComment] = useState("");
  const [clientName, setClientName] = useState("");
  const [error, setError] = useState("");

  const lead = useQuery({
    queryKey: ["adminLead", leadId],
    queryFn: () => api.adminLead(leadId)
  });

  useEffect(() => {
    if (lead.data?.lead) {
      setStatus(lead.data.lead.status);
      setManagerId(lead.data.lead.assignedManagerId ?? "");
      setAdminComment(lead.data.lead.adminComment ?? "");
      setClientName(lead.data.lead.clientName ?? "");
    }
  }, [lead.data]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["adminLead", leadId] }),
      queryClient.invalidateQueries({ queryKey: ["adminLeads"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    ]);
  };

  const updateLead = useMutation({
    mutationFn: () => api.updateAdminLead(leadId, { status, adminComment, clientName }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось сохранить заявку")
  });

  const assign = useMutation({
    mutationFn: () => api.assignLead(leadId, managerId || null),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось назначить менеджера")
  });

  const current = lead.data?.lead;

  return (
    <Modal title="Карточка заявки" onClose={onClose}>
      {lead.isLoading && <div className="text-slate-300">Загрузка...</div>}
      {current && (
        <div className="space-y-5">
          {error && <div className="rounded-md border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</div>}
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="Модель" value={SOFA_MODEL_LABELS[current.selectedModel]} />
            <Info label="Телефон" value={current.phone} />
            <Info label="Источник" value={current.source} />
            <Info label="Создана" value={formatDate(current.createdAt)} />
            <Info label="Обновлена" value={formatDate(current.updatedAt)} />
            <Info label="Повторы телефона" value={String(current.duplicateCount ?? 0)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-medium">Статус</span>
              <select className="field" value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">Менеджер</span>
              <select className="field" value={managerId} onChange={(event) => setManagerId(event.target.value)}>
                <option value="">Без менеджера</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Имя клиента</span>
            <input className="field" value={clientName} onChange={(event) => setClientName(event.target.value)} />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Комментарий руководства</span>
            <textarea className="field min-h-28" value={adminComment} onChange={(event) => setAdminComment(event.target.value)} />
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => updateLead.mutate()} disabled={updateLead.isPending}>
              Сохранить
            </button>
            <button type="button" className="btn-secondary" onClick={() => assign.mutate()} disabled={assign.isPending}>
              Назначить менеджера
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setStatus("archived");
                api.updateAdminLead(leadId, { status: "archived" }).then(invalidate).catch(() => setError("Не удалось архивировать"));
              }}
            >
              Архивировать
            </button>
          </div>

          {Boolean(current.similarLeads?.length) && (
            <section>
              <h3 className="mb-2 font-semibold">Похожие заявки по телефону</h3>
              <div className="space-y-2">
                {current.similarLeads?.map((item) => (
                  <div key={item.id} className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm">
                    {formatDate(item.createdAt)} · {SOFA_MODEL_LABELS[item.selectedModel]} · <StatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 font-semibold">История действий</h3>
            <div className="space-y-2">
              {current.activities?.map((activity) => (
                <div key={activity.id} className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm">
                  <p className="font-medium">{activity.action}</p>
                  <p className="text-slate-400">
                    {formatDate(activity.createdAt)} · {activity.user?.name ?? "Публичный пользователь"}
                  </p>
                  {(activity.oldValue || activity.newValue) && (
                    <p className="mt-1 text-slate-300">
                      {activity.oldValue ?? "—"} → {activity.newValue ?? "—"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2">
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
