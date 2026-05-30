import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import {
  formatDate,
  MANAGER_STATUS_OPTIONS,
  SOFA_MODELS,
  SOFA_MODEL_LABELS,
  STATUS_OPTIONS
} from "../lib/constants";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import type { LeadStatus, SofaModel } from "../types/api";

export function ManagerLeadsPage() {
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [model, setModel] = useState<SofaModel | "">("");
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const leads = useQuery({
    queryKey: ["managerLeads", status, model, search],
    queryFn: () =>
      api.managerLeads({
        status: status || undefined,
        model: model || undefined,
        search
      })
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Мои заявки</h1>
        <p className="mt-1 text-sm text-slate-400">Заявки, назначенные вам руководством.</p>
      </div>

      <section className="panel p-4">
        <div className="grid gap-3 md:grid-cols-3">
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
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Модель</th>
                <th className="px-4 py-3">Телефон</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Комментарий</th>
                <th className="px-4 py-3">Обновлено</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {leads.data?.leads.map((lead) => (
                <tr key={lead.id} className="cursor-pointer hover:bg-slate-800/60" onClick={() => setSelectedLeadId(lead.id)}>
                  <td className="px-4 py-3">{formatDate(lead.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{SOFA_MODEL_LABELS[lead.selectedModel]}</td>
                  <td className="px-4 py-3">{lead.phone}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3">{lead.managerComment || "—"}</td>
                  <td className="px-4 py-3">{formatDate(lead.updatedAt)}</td>
                </tr>
              ))}
              {!leads.isLoading && !leads.data?.leads.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Назначенных заявок пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedLeadId && <ManagerLeadModal leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
    </div>
  );
}

function ManagerLeadModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LeadStatus>("in_work");
  const [managerComment, setManagerComment] = useState("");
  const [error, setError] = useState("");

  const lead = useQuery({
    queryKey: ["managerLead", leadId],
    queryFn: () => api.managerLead(leadId)
  });

  useEffect(() => {
    if (lead.data?.lead) {
      setStatus(lead.data.lead.status === "new" || lead.data.lead.status === "archived" ? "in_work" : lead.data.lead.status);
      setManagerComment(lead.data.lead.managerComment ?? "");
    }
  }, [lead.data]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["managerLead", leadId] }),
      queryClient.invalidateQueries({ queryKey: ["managerLeads"] })
    ]);
  };

  const updateStatus = useMutation({
    mutationFn: () => api.updateManagerLeadStatus(leadId, status),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось сменить статус")
  });

  const updateComment = useMutation({
    mutationFn: () => api.updateManagerLeadComment(leadId, managerComment),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось сохранить комментарий")
  });

  const current = lead.data?.lead;

  return (
    <Modal title="Моя заявка" onClose={onClose}>
      {lead.isLoading && <div className="text-slate-300">Загрузка...</div>}
      {current && (
        <div className="space-y-5">
          {error && <div className="rounded-md border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</div>}
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="Модель" value={SOFA_MODEL_LABELS[current.selectedModel]} />
            <Info label="Телефон" value={current.phone} />
            <Info label="Создана" value={formatDate(current.createdAt)} />
            <Info label="Текущий статус" value={current.status} />
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Статус</span>
            <select className="field" value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)}>
              {MANAGER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Комментарий</span>
            <textarea className="field min-h-28" value={managerComment} onChange={(event) => setManagerComment(event.target.value)} />
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => updateStatus.mutate()} disabled={updateStatus.isPending}>
              Сменить статус
            </button>
            <button type="button" className="btn-secondary" onClick={() => updateComment.mutate()} disabled={updateComment.isPending}>
              Сохранить комментарий
            </button>
          </div>

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
