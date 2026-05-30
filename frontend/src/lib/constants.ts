import type { LeadStatus, SofaModel } from "../types/api";

export const SOFA_MODELS: Array<{ value: SofaModel; label: string; number: string }> = [
  { value: "PAULA", label: "Паула", number: "1" },
  { value: "BERGEN", label: "Берген", number: "2" },
  { value: "VICTORIA", label: "Виктория", number: "3" },
  { value: "MARK", label: "Марк", number: "4" },
  { value: "MALYSH", label: "Малыш", number: "5" },
  { value: "MALTA", label: "Мальта", number: "6" },
  { value: "ELVIS_B", label: "Элвис", number: "7" },
  { value: "DUBLIN", label: "Дублин", number: "8" },
  { value: "TOMAS", label: "Томас", number: "9" },
  { value: "BRIGHTON", label: "Брайтон", number: "10" },
  { value: "GUDZON", label: "Гудзон", number: "11" },
  { value: "NIZZA", label: "Ницца", number: "12" },
  { value: "MILAN", label: "Милан", number: "13" },
  { value: "RIO_KIDS", label: "Рио (детский)", number: "14" }
];

export const SOFA_MODEL_LABELS: Record<SofaModel, string> = Object.fromEntries(
  SOFA_MODELS.map((model) => [model.value, model.label])
) as Record<SofaModel, string>;

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Новая",
  in_work: "В работе",
  contacted: "Связались",
  waiting_client: "Ждём клиента",
  success: "Успешно",
  failed: "Отказ",
  archived: "Архив"
};

export const STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: "new", label: STATUS_LABELS.new },
  { value: "in_work", label: STATUS_LABELS.in_work },
  { value: "contacted", label: STATUS_LABELS.contacted },
  { value: "waiting_client", label: STATUS_LABELS.waiting_client },
  { value: "success", label: STATUS_LABELS.success },
  { value: "failed", label: STATUS_LABELS.failed },
  { value: "archived", label: STATUS_LABELS.archived }
];

export const MANAGER_STATUS_OPTIONS = STATUS_OPTIONS.filter((status) => {
  return ["in_work", "contacted", "waiting_client", "success", "failed"].includes(status.value);
});

export const STATUS_BADGE_CLASS: Record<LeadStatus, string> = {
  new: "bg-sky-500/15 text-sky-200 border-sky-400/30",
  in_work: "bg-amber-500/15 text-amber-200 border-amber-400/30",
  contacted: "bg-indigo-500/15 text-indigo-200 border-indigo-400/30",
  waiting_client: "bg-violet-500/15 text-violet-200 border-violet-400/30",
  success: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  failed: "bg-rose-500/15 text-rose-200 border-rose-400/30",
  archived: "bg-slate-700 text-slate-300 border-slate-600"
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
