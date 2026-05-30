import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? "development";
const cookieSecure =
  process.env.COOKIE_SECURE === undefined ? nodeEnv === "production" : process.env.COOKIE_SECURE === "true";

export const config = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: Number(process.env.PORT ?? 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  corsOrigins: (process.env.CORS_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  authCookieName: process.env.AUTH_COOKIE_NAME ?? "sofa_crm_token",
  cookieSecure,
  publicSofaLeadsEnabled: process.env.PUBLIC_SOFA_LEADS_ENABLED === "true",
  telegram: {
    enabled: process.env.TELEGRAM_ENABLED === "true",
    leadBotEnabled: process.env.TELEGRAM_LEAD_BOT_ENABLED !== "false",
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    leadChannelId: process.env.TELEGRAM_LEAD_CHANNEL_ID ?? "",
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ?? "",
    proxyUrl: process.env.TELEGRAM_PROXY_URL ?? ""
  }
};

export function assertRuntimeConfig() {
  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }
}
