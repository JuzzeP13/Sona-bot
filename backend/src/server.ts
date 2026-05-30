import { assertRuntimeConfig, config } from "./config";
import { createApp } from "./app";
import { prisma } from "./prisma";
import { telegramService } from "./services/telegram.service";

assertRuntimeConfig();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`Backend API listening on port ${config.port}`);
  telegramService.startPolling();
});

async function shutdown() {
  telegramService.stopPolling();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
