import { Router } from "express";
import { Prisma, type LeadStatus } from "@prisma/client";
import { z } from "zod";
import { isLeadStatus, isSofaModel, LEAD_STATUS_LABELS, MANAGER_EDITABLE_STATUSES } from "../constants";
import { prisma } from "../prisma";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

const managerLeadSelect = {
  id: true,
  selectedModel: true,
  phone: true,
  normalizedPhone: true,
  status: true,
  assignedManagerId: true,
  source: true,
  clientName: true,
  managerComment: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.SofaLeadSelect;

function sanitizeActivityForManager(activity: {
  id: string;
  leadId: string;
  userId: string | null;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  user: { id: string; name: string; role: string } | null;
}) {
  const isAdminCommentActivity = activity.action.includes("комментарий руководства");

  return {
    ...activity,
    oldValue: isAdminCommentActivity ? null : activity.oldValue,
    newValue: isAdminCommentActivity ? null : activity.newValue
  };
}

router.get(
  "/leads",
  asyncHandler(async (req, res) => {
    const where: Prisma.SofaLeadWhereInput = {
      assignedManagerId: req.user!.id
    };

    if (typeof req.query.status === "string" && isLeadStatus(req.query.status)) {
      where.status = req.query.status;
    }

    if (typeof req.query.model === "string" && isSofaModel(req.query.model)) {
      where.selectedModel = req.query.model;
    }

    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const search = req.query.search.trim();
      where.OR = [
        { phone: { contains: search, mode: "insensitive" } },
        { normalizedPhone: { contains: search.replace(/[\s()-]/g, ""), mode: "insensitive" } },
        { managerComment: { contains: search, mode: "insensitive" } }
      ];
    }

    const leads = await prisma.sofaLead.findMany({
      where,
      select: managerLeadSelect,
      orderBy: { createdAt: "desc" }
    });

    return res.json({ leads });
  })
);

router.get(
  "/leads/:id",
  asyncHandler(async (req, res) => {
    const leadId = String(req.params.id);
    const lead = await prisma.sofaLead.findFirst({
      where: {
        id: leadId,
        assignedManagerId: req.user!.id
      },
      select: {
        ...managerLeadSelect,
        activities: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    return res.json({
      lead: {
        id: lead.id,
        selectedModel: lead.selectedModel,
        phone: lead.phone,
        normalizedPhone: lead.normalizedPhone,
        status: lead.status,
        assignedManagerId: lead.assignedManagerId,
        source: lead.source,
        clientName: lead.clientName,
        managerComment: lead.managerComment,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        activities: lead.activities.map(sanitizeActivityForManager)
      }
    });
  })
);

const updateStatusSchema = z.object({
  status: z.string()
});

router.patch(
  "/leads/:id/status",
  asyncHandler(async (req, res) => {
    const body = updateStatusSchema.parse(req.body);

    if (!isLeadStatus(body.status) || !MANAGER_EDITABLE_STATUSES.includes(body.status)) {
      return res.status(400).json({ message: "Менеджер не может установить этот статус" });
    }

    const leadId = String(req.params.id);
    const nextStatus = body.status as LeadStatus;

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.sofaLead.findFirst({
        where: { id: leadId, assignedManagerId: req.user!.id }
      });

      if (!current) {
        return null;
      }

      const lead = await tx.sofaLead.update({
        where: { id: current.id },
        data: { status: nextStatus }
      });

      if (current.status !== nextStatus) {
        await tx.leadActivityLog.create({
          data: {
            leadId: lead.id,
            userId: req.user!.id,
            action: "Менеджер изменил статус заявки",
            oldValue: LEAD_STATUS_LABELS[current.status],
            newValue: LEAD_STATUS_LABELS[nextStatus]
          }
        });
      }

      return lead;
    });

    if (!result) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    return res.json({ lead: result });
  })
);

const updateCommentSchema = z.object({
  managerComment: z.string().max(5000).nullable()
});

router.patch(
  "/leads/:id/comment",
  asyncHandler(async (req, res) => {
    const body = updateCommentSchema.parse(req.body);
    const leadId = String(req.params.id);

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.sofaLead.findFirst({
        where: { id: leadId, assignedManagerId: req.user!.id }
      });

      if (!current) {
        return null;
      }

      const lead = await tx.sofaLead.update({
        where: { id: current.id },
        data: { managerComment: body.managerComment || null }
      });

      if (current.managerComment !== body.managerComment) {
        await tx.leadActivityLog.create({
          data: {
            leadId: lead.id,
            userId: req.user!.id,
            action: "Менеджер изменил комментарий",
            oldValue: current.managerComment,
            newValue: body.managerComment
          }
        });
      }

      return lead;
    });

    if (!result) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    return res.json({ lead: result });
  })
);

export default router;
