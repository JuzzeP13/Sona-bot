import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { config } from "../config";
import { SOFA_MODEL_LABELS, resolveSofaModel } from "../constants";
import { publicLeadLimiter } from "../middleware/rateLimit";
import { telegramService } from "../services/telegram.service";
import { asyncHandler } from "../utils/asyncHandler";
import { normalizeRussianPhone } from "../utils/phone";

const router = Router();

const createLeadSchema = z.object({
  selectedModel: z.string().min(1),
  phone: z.string().min(1),
  clientName: z.string().trim().max(120).optional()
});

router.post(
  "/sofa-leads",
  publicLeadLimiter,
  asyncHandler(async (req, res) => {
    if (!config.publicSofaLeadsEnabled) {
      return res.status(404).json({ message: "Публичный прием заявок временно отключен" });
    }

    const body = createLeadSchema.parse(req.body);
    const selectedModel = resolveSofaModel(body.selectedModel);

    if (!selectedModel) {
      return res.status(400).json({ message: "Выберите модель дивана" });
    }

    const normalizedPhone = normalizeRussianPhone(body.phone);
    if (!normalizedPhone) {
      return res.status(400).json({
        message: "Пожалуйста, напишите номер телефона в формате +7"
      });
    }

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.sofaLead.create({
        data: {
          selectedModel,
          phone: body.phone.trim(),
          normalizedPhone,
          source: "sofa-bot",
          clientName: body.clientName?.trim() || null
        }
      });

      await tx.leadActivityLog.create({
        data: {
          leadId: created.id,
          userId: null,
          action: "Заявка создана публичным пользователем",
          oldValue: null,
          newValue: `${SOFA_MODEL_LABELS[selectedModel]}, ${normalizedPhone}`
        }
      });

      return created;
    });

    void telegramService.notifyNewLead(lead);

    return res.status(201).json({
      lead: {
        id: lead.id,
        selectedModel: lead.selectedModel,
        status: lead.status,
        createdAt: lead.createdAt
      }
    });
  })
);

export default router;
