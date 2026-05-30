import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { clearAuthCookie, createAuthToken, requireAuth, setAuthCookie } from "../middleware/auth";
import { loginLimiter } from "../middleware/rateLimit";
import { toSafeUser } from "../utils/safeUser";

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1)
});

router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const invalidMessage = { message: "Неверный логин или пароль" };

    const user = await prisma.user.findUnique({
      where: { email: body.email }
    });

    if (!user || !user.isActive) {
      return res.status(401).json(invalidMessage);
    }

    const isPasswordValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json(invalidMessage);
    }

    const token = createAuthToken(user.id);
    setAuthCookie(res, token);

    return res.json({ user: toSafeUser(user) });
  })
);

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id }
    });

    return res.json({ user: toSafeUser(user) });
  })
);

export default router;
