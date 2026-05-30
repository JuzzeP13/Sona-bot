import { LeadStatus, SofaModel } from "@prisma/client";

export const SOFA_MODEL_LABELS: Record<SofaModel, string> = {
  ELVIS_B: "Элвис",
  MARK: "Марк",
  BERGEN: "Берген",
  PAULA: "Паула",
  RIO_KIDS: "Рио (детский)",
  MALTA: "Мальта",
  VICTORIA: "Виктория",
  MALYSH: "Малыш",
  DUBLIN: "Дублин",
  TOMAS: "Томас",
  BRIGHTON: "Брайтон",
  GUDZON: "Гудзон",
  NIZZA: "Ницца",
  MILAN: "Милан"
};

export const SOFA_MODEL_BY_NUMBER: Record<string, SofaModel> = {
  "1": "PAULA",
  "2": "BERGEN",
  "3": "VICTORIA",
  "4": "MARK",
  "5": "MALYSH",
  "6": "MALTA",
  "7": "ELVIS_B",
  "8": "DUBLIN",
  "9": "TOMAS",
  "10": "BRIGHTON",
  "11": "GUDZON",
  "12": "NIZZA",
  "13": "MILAN"
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Новая",
  in_work: "В работе",
  contacted: "Связались",
  waiting_client: "Ждём клиента",
  success: "Успешно закрыта",
  failed: "Отказ/неактуально",
  archived: "Архив"
};

export const MANAGER_EDITABLE_STATUSES: LeadStatus[] = [
  "in_work",
  "contacted",
  "waiting_client",
  "success",
  "failed"
];

export function isSofaModel(value: string): value is SofaModel {
  return Object.values(SofaModel).includes(value as SofaModel);
}

export function isLeadStatus(value: string): value is LeadStatus {
  return Object.values(LeadStatus).includes(value as LeadStatus);
}

export function resolveSofaModel(value: string): SofaModel | null {
  const trimmed = value.trim();
  if (SOFA_MODEL_BY_NUMBER[trimmed]) {
    return SOFA_MODEL_BY_NUMBER[trimmed];
  }

  if (isSofaModel(trimmed)) {
    return trimmed;
  }

  const byLabel = Object.entries(SOFA_MODEL_LABELS).find(([, label]) => {
    return label.toLowerCase() === trimmed.toLowerCase();
  });

  return byLabel ? (byLabel[0] as SofaModel) : null;
}
