import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: "Не найдено" });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Ошибка валидации",
      errors: error.flatten()
    });
  }

  console.error(error);
  return res.status(500).json({ message: "Внутренняя ошибка сервера" });
}
