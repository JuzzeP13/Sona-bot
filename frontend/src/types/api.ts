export type UserRole = "admin" | "manager";

export type SofaModel =
  | "ELVIS_B"
  | "MARK"
  | "BERGEN"
  | "PAULA"
  | "RIO_KIDS"
  | "MALTA"
  | "VICTORIA"
  | "MALYSH"
  | "DUBLIN"
  | "TOMAS"
  | "BRIGHTON"
  | "GUDZON"
  | "NIZZA"
  | "MILAN";

export type LeadStatus =
  | "new"
  | "in_work"
  | "contacted"
  | "waiting_client"
  | "success"
  | "failed"
  | "archived";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  telegramChatId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Manager = User & {
  stats?: {
    totalAssigned: number;
    inWork: number;
    success: number;
    failed: number;
    conversion: number;
  };
};

export type LeadActivity = {
  id: string;
  leadId: string;
  userId: string | null;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: User | null;
};

export type SofaLead = {
  id: string;
  selectedModel: SofaModel;
  phone: string;
  normalizedPhone: string;
  status: LeadStatus;
  assignedManagerId: string | null;
  assignedManager?: User | null;
  source: string;
  clientName: string | null;
  adminComment: string | null;
  managerComment: string | null;
  createdAt: string;
  updatedAt: string;
  duplicateCount?: number;
  similarLeads?: SofaLead[];
  activities?: LeadActivity[];
};

export type DashboardStats = {
  totals: {
    total: number;
    new: number;
    in_work: number;
    success: number;
    failed: number;
    unassigned: number;
    today: number;
    week: number;
    month: number;
  };
  managers: Array<{
    manager: User;
    totalAssigned: number;
    inWork: number;
    success: number;
    failed: number;
    conversion: number;
  }>;
  models: Array<{
    model: SofaModel;
    label: string;
    count: number;
  }>;
};
