import type { DashboardStats, LeadStatus, Manager, SofaLead, SofaModel, User } from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, payload?.message ?? "Ошибка запроса");
  }

  return payload as T;
}

function toQuery(params: Record<string, string | boolean | undefined | null>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const asString = query.toString();
  return asString ? `?${asString}` : "";
}

export const api = {
  login(email: string, password: string) {
    return request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  logout() {
    return request<{ ok: true }>("/auth/logout", { method: "POST" });
  },

  me() {
    return request<{ user: User }>("/auth/me");
  },

  createPublicLead(input: { selectedModel: SofaModel | string; phone: string }) {
    return request<{ lead: Pick<SofaLead, "id" | "selectedModel" | "status" | "createdAt"> }>(
      "/public/sofa-leads",
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    );
  },

  adminLeads(params: {
    status?: LeadStatus;
    model?: SofaModel;
    managerId?: string;
    search?: string;
    onlyNew?: boolean;
    unassigned?: boolean;
  }) {
    return request<{ total: number; leads: SofaLead[] }>(`/admin/leads${toQuery(params)}`);
  },

  adminLead(id: string) {
    return request<{ lead: SofaLead }>(`/admin/leads/${id}`);
  },

  updateAdminLead(id: string, input: Partial<Pick<SofaLead, "status" | "adminComment" | "managerComment" | "clientName">>) {
    return request<{ lead: SofaLead }>(`/admin/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  assignLead(id: string, managerId: string | null) {
    return request<{ lead: SofaLead }>(`/admin/leads/${id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ managerId })
    });
  },

  dashboard() {
    return request<DashboardStats>("/admin/leads/stats");
  },

  managers() {
    return request<{ managers: Manager[] }>("/admin/managers");
  },

  createManager(input: { name: string; email: string; password: string; telegramChatId?: string }) {
    return request<{ manager: Manager }>("/admin/managers", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  updateManager(id: string, input: Partial<Pick<Manager, "name" | "email" | "telegramChatId">>) {
    return request<{ manager: Manager }>(`/admin/managers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  updateManagerPassword(id: string, password: string) {
    return request<{ manager: Manager }>(`/admin/managers/${id}/password`, {
      method: "PATCH",
      body: JSON.stringify({ password })
    });
  },

  activateManager(id: string) {
    return request<{ manager: Manager }>(`/admin/managers/${id}/activate`, { method: "PATCH" });
  },

  deactivateManager(id: string) {
    return request<{ manager: Manager }>(`/admin/managers/${id}/deactivate`, { method: "PATCH" });
  },

  managerLeads(params: { status?: LeadStatus; model?: SofaModel; search?: string }) {
    return request<{ leads: SofaLead[] }>(`/manager/leads${toQuery(params)}`);
  },

  managerLead(id: string) {
    return request<{ lead: SofaLead }>(`/manager/leads/${id}`);
  },

  updateManagerLeadStatus(id: string, status: LeadStatus) {
    return request<{ lead: SofaLead }>(`/manager/leads/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  },

  updateManagerLeadComment(id: string, managerComment: string | null) {
    return request<{ lead: SofaLead }>(`/manager/leads/${id}/comment`, {
      method: "PATCH",
      body: JSON.stringify({ managerComment })
    });
  }
};
