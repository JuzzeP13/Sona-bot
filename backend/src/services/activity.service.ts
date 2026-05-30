import { prisma } from "../prisma";

type LogLeadActivityInput = {
  leadId: string;
  userId?: string | null;
  action: string;
  oldValue?: string | null;
  newValue?: string | null;
};

export async function logLeadActivity(input: LogLeadActivityInput) {
  return prisma.leadActivityLog.create({
    data: {
      leadId: input.leadId,
      userId: input.userId ?? null,
      action: input.action,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null
    }
  });
}
