import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma, type LeadStatus, type SofaModel } from "@prisma/client";
import { z } from "zod";
import { isLeadStatus, isSofaModel, LEAD_STATUS_LABELS, SOFA_MODEL_LABELS } from "../constants";
import { prisma } from "../prisma";
import { telegramService } from "../services/telegram.service";
import { asyncHandler } from "../utils/asyncHandler";
import { toSafeUser } from "../utils/safeUser";

const router = Router();

function parseLimit(value: unknown) {
  const parsed = Number(value ?? 50);
  if (Number.isNaN(parsed)) {
    return 50;
  }
  return Math.min(Math.max(parsed, 1), 100);
}

function parseDate(value: unknown) {
  if (!value || typeof value !== "string") {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getModelMatches(search: string): SofaModel[] {
  const normalized = search.toLowerCase();
  return Object.entries(SOFA_MODEL_LABELS)
    .filter(([model, label]) => {
      return model.toLowerCase().includes(normalized) || label.toLowerCase().includes(normalized);
    })
    .map(([model]) => model as SofaModel);
}

async function attachDuplicateCounts<T extends { normalizedPhone: string }>(leads: T[]) {
  return Promise.all(
    leads.map(async (lead) => {
      const count = await prisma.sofaLead.count({
        where: { normalizedPhone: lead.normalizedPhone }
      });

      return {
        ...lead,
        duplicateCount: Math.max(count - 1, 0)
      };
    })
  );
}

router.get(
  "/leads/stats",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const [
      total,
      newCount,
      inWork,
      success,
      failed,
      unassigned,
      todayCount,
      weekCount,
      monthCount,
      byModelRaw,
      managers
    ] = await Promise.all([
      prisma.sofaLead.count(),
      prisma.sofaLead.count({ where: { status: "new" } }),
      prisma.sofaLead.count({ where: { status: "in_work" } }),
      prisma.sofaLead.count({ where: { status: "success" } }),
      prisma.sofaLead.count({ where: { status: "failed" } }),
      prisma.sofaLead.count({ where: { assignedManagerId: null } }),
      prisma.sofaLead.count({ where: { createdAt: { gte: today } } }),
      prisma.sofaLead.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.sofaLead.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.sofaLead.groupBy({
        by: ["selectedModel"],
        _count: { _all: true }
      }),
      prisma.user.findMany({
        where: { role: "manager" },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const managerStats = await Promise.all(
      managers.map(async (manager) => {
        const grouped = await prisma.sofaLead.groupBy({
          by: ["status"],
          where: { assignedManagerId: manager.id },
          _count: { _all: true }
        });

        const byStatus = Object.fromEntries(grouped.map((item) => [item.status, item._count._all]));
        const totalAssigned = Object.values(byStatus).reduce((sum, value) => sum + value, 0);
        const successCount = byStatus.success ?? 0;

        return {
          manager: toSafeUser(manager),
          totalAssigned,
          inWork: byStatus.in_work ?? 0,
          success: successCount,
          failed: byStatus.failed ?? 0,
          conversion: totalAssigned ? Math.round((successCount / totalAssigned) * 100) : 0
        };
      })
    );

    const byModel = Object.values(SOFA_MODEL_LABELS).map((label) => label);
    const modelStats = Object.entries(SOFA_MODEL_LABELS).map(([model, label]) => {
      const found = byModelRaw.find((item) => item.selectedModel === model);
      return {
        model,
        label,
        count: found?._count._all ?? 0
      };
    });

    return res.json({
      totals: {
        total,
        new: newCount,
        in_work: inWork,
        success,
        failed,
        unassigned,
        today: todayCount,
        week: weekCount,
        month: monthCount
      },
      managers: managerStats,
      models: modelStats,
      labels: {
        statuses: LEAD_STATUS_LABELS,
        models: byModel
      }
    });
  })
);

router.get(
  "/leads",
  asyncHandler(async (req, res) => {
    const where: Prisma.SofaLeadWhereInput = {};
    const limit = parseLimit(req.query.limit);
    const skip = Math.max(Number(req.query.skip ?? 0), 0);

    if (typeof req.query.status === "string" && isLeadStatus(req.query.status)) {
      where.status = req.query.status;
    }

    if (req.query.onlyNew === "true") {
      where.status = "new";
    }

    if (typeof req.query.model === "string" && isSofaModel(req.query.model)) {
      where.selectedModel = req.query.model;
    }

    if (typeof req.query.managerId === "string" && req.query.managerId) {
      where.assignedManagerId = req.query.managerId;
    }

    if (req.query.unassigned === "true") {
      where.assignedManagerId = null;
    }

    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {})
      };
    }

    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const search = req.query.search.trim();
      const modelMatches = getModelMatches(search);
      where.OR = [
        { phone: { contains: search, mode: "insensitive" } },
        { normalizedPhone: { contains: search.replace(/[\s()-]/g, ""), mode: "insensitive" } },
        { adminComment: { contains: search, mode: "insensitive" } },
        { managerComment: { contains: search, mode: "insensitive" } },
        ...(modelMatches.length ? [{ selectedModel: { in: modelMatches } }] : [])
      ];
    }

    const [total, leads] = await Promise.all([
      prisma.sofaLead.count({ where }),
      prisma.sofaLead.findMany({
        where,
        skip,
        take: limit,
        include: {
          assignedManager: true
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const leadsWithDuplicates = await attachDuplicateCounts(
      leads.map((lead) => ({
        ...lead,
        assignedManager: lead.assignedManager ? toSafeUser(lead.assignedManager) : null
      }))
    );

    return res.json({ total, leads: leadsWithDuplicates });
  })
);

router.get(
  "/leads/:id",
  asyncHandler(async (req, res) => {
    const leadId = String(req.params.id);
    const lead = await prisma.sofaLead.findUnique({
      where: { id: leadId },
      include: {
        assignedManager: true,
        activities: {
          include: { user: true },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    const similarLeads = await prisma.sofaLead.findMany({
      where: {
        normalizedPhone: lead.normalizedPhone,
        id: { not: lead.id }
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { assignedManager: true }
    });

    return res.json({
      lead: {
        ...lead,
        assignedManager: lead.assignedManager ? toSafeUser(lead.assignedManager) : null,
        activities: lead.activities.map((activity) => ({
          ...activity,
          user: activity.user ? toSafeUser(activity.user) : null
        })),
        duplicateCount: similarLeads.length,
        similarLeads: similarLeads.map((item) => ({
          ...item,
          assignedManager: item.assignedManager ? toSafeUser(item.assignedManager) : null
        }))
      }
    });
  })
);

const updateLeadSchema = z.object({
  status: z.string().optional(),
  adminComment: z.string().max(5000).nullable().optional(),
  managerComment: z.string().max(5000).nullable().optional(),
  clientName: z.string().max(120).nullable().optional()
});

router.patch(
  "/leads/:id",
  asyncHandler(async (req, res) => {
    const body = updateLeadSchema.parse(req.body);
    const leadId = String(req.params.id);
    const data: Prisma.SofaLeadUpdateInput = {};

    if (body.status !== undefined) {
      if (!isLeadStatus(body.status)) {
        return res.status(400).json({ message: "Неверный статус" });
      }
      data.status = body.status;
    }

    if (body.adminComment !== undefined) {
      data.adminComment = body.adminComment || null;
    }

    if (body.managerComment !== undefined) {
      data.managerComment = body.managerComment || null;
    }

    if (body.clientName !== undefined) {
      data.clientName = body.clientName || null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.sofaLead.findUnique({
        where: { id: leadId }
      });

      if (!current) {
        return null;
      }

      const lead = await tx.sofaLead.update({
        where: { id: leadId },
        data
      });

      const logs: Prisma.LeadActivityLogCreateManyInput[] = [];

      if (body.status !== undefined && current.status !== body.status) {
        logs.push({
          leadId: lead.id,
          userId: req.user!.id,
          action: body.status === "archived" ? "Заявка архивирована" : "Изменён статус заявки",
          oldValue: LEAD_STATUS_LABELS[current.status],
          newValue: LEAD_STATUS_LABELS[body.status as LeadStatus]
        });
      }

      if (body.adminComment !== undefined && current.adminComment !== body.adminComment) {
        logs.push({
          leadId: lead.id,
          userId: req.user!.id,
          action: "Изменён комментарий руководства",
          oldValue: current.adminComment,
          newValue: body.adminComment
        });
      }

      if (body.managerComment !== undefined && current.managerComment !== body.managerComment) {
        logs.push({
          leadId: lead.id,
          userId: req.user!.id,
          action: "Изменён комментарий менеджера",
          oldValue: current.managerComment,
          newValue: body.managerComment
        });
      }

      if (body.clientName !== undefined && current.clientName !== body.clientName) {
        logs.push({
          leadId: lead.id,
          userId: req.user!.id,
          action: "Изменено имя клиента",
          oldValue: current.clientName,
          newValue: body.clientName
        });
      }

      if (logs.length) {
        await tx.leadActivityLog.createMany({ data: logs });
      }

      return lead;
    });

    if (!updated) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    return res.json({ lead: updated });
  })
);

const assignSchema = z.object({
  managerId: z.string().nullable()
});

router.patch(
  "/leads/:id/assign",
  asyncHandler(async (req, res) => {
    const body = assignSchema.parse(req.body);
    const leadId = String(req.params.id);

    const manager = body.managerId
      ? await prisma.user.findFirst({
          where: { id: body.managerId, role: "manager", isActive: true }
        })
      : null;

    if (body.managerId && !manager) {
      return res.status(400).json({ message: "Активный менеджер не найден" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.sofaLead.findUnique({
        where: { id: leadId },
        include: { assignedManager: true }
      });

      if (!current) {
        return null;
      }

      const lead = await tx.sofaLead.update({
        where: { id: current.id },
        data: { assignedManagerId: manager?.id ?? null }
      });

      await tx.leadActivityLog.create({
        data: {
          leadId: lead.id,
          userId: req.user!.id,
          action: "Назначен менеджер",
          oldValue: current.assignedManager?.name ?? "Без менеджера",
          newValue: manager?.name ?? "Без менеджера"
        }
      });

      return lead;
    });

    if (!result) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    void telegramService.notifyManagerAssigned(manager?.telegramChatId, result);

    return res.json({ lead: result });
  })
);

router.get(
  "/managers",
  asyncHandler(async (_req, res) => {
    const managers = await prisma.user.findMany({
      where: { role: "manager" },
      orderBy: { createdAt: "desc" }
    });

    const result = await Promise.all(
      managers.map(async (manager) => {
        const grouped = await prisma.sofaLead.groupBy({
          by: ["status"],
          where: { assignedManagerId: manager.id },
          _count: { _all: true }
        });
        const byStatus = Object.fromEntries(grouped.map((item) => [item.status, item._count._all]));
        const totalAssigned = Object.values(byStatus).reduce((sum, value) => sum + value, 0);

        return {
          ...toSafeUser(manager),
          stats: {
            totalAssigned,
            inWork: byStatus.in_work ?? 0,
            success: byStatus.success ?? 0,
            failed: byStatus.failed ?? 0,
            conversion: totalAssigned ? Math.round(((byStatus.success ?? 0) / totalAssigned) * 100) : 0
          }
        };
      })
    );

    return res.json({ managers: result });
  })
);

const createManagerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  telegramChatId: z.string().trim().max(120).optional().nullable()
});

router.post(
  "/managers",
  asyncHandler(async (req, res) => {
    const body = createManagerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return res.status(409).json({ message: "Пользователь с таким email уже существует" });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const manager = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        role: "manager",
        isActive: true,
        telegramChatId: body.telegramChatId || null
      }
    });

    return res.status(201).json({ manager: toSafeUser(manager) });
  })
);

const updateManagerSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  telegramChatId: z.string().trim().max(120).nullable().optional()
});

router.patch(
  "/managers/:id",
  asyncHandler(async (req, res) => {
    const body = updateManagerSchema.parse(req.body);
    const managerId = String(req.params.id);

    if (body.email) {
      const existing = await prisma.user.findFirst({
        where: { email: body.email, id: { not: managerId } }
      });

      if (existing) {
        return res.status(409).json({ message: "Пользователь с таким email уже существует" });
      }
    }

    const manager = await prisma.user.update({
      where: { id: managerId, role: "manager" },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.telegramChatId !== undefined ? { telegramChatId: body.telegramChatId || null } : {})
      }
    });

    return res.json({ manager: toSafeUser(manager) });
  })
);

const updatePasswordSchema = z.object({
  password: z.string().min(8).max(200)
});

router.patch(
  "/managers/:id/password",
  asyncHandler(async (req, res) => {
    const body = updatePasswordSchema.parse(req.body);
    const managerId = String(req.params.id);
    const passwordHash = await bcrypt.hash(body.password, 12);

    const manager = await prisma.user.update({
      where: { id: managerId, role: "manager" },
      data: { passwordHash }
    });

    return res.json({ manager: toSafeUser(manager) });
  })
);

async function setManagerActive(managerId: string, isActive: boolean, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const manager = await tx.user.update({
      where: { id: managerId, role: "manager" },
      data: { isActive }
    });

    const leads = await tx.sofaLead.findMany({
      where: { assignedManagerId: managerId },
      select: { id: true }
    });

    if (leads.length) {
      await tx.leadActivityLog.createMany({
        data: leads.map((lead) => ({
          leadId: lead.id,
          userId: adminId,
          action: isActive ? "Менеджер включён" : "Менеджер отключён",
          oldValue: manager.name,
          newValue: manager.name
        }))
      });
    }

    return manager;
  });
}

router.patch(
  "/managers/:id/activate",
  asyncHandler(async (req, res) => {
    const manager = await setManagerActive(String(req.params.id), true, req.user!.id);
    return res.json({ manager: toSafeUser(manager) });
  })
);

router.patch(
  "/managers/:id/deactivate",
  asyncHandler(async (req, res) => {
    const manager = await setManagerActive(String(req.params.id), false, req.user!.id);
    return res.json({ manager: toSafeUser(manager) });
  })
);

export default router;
