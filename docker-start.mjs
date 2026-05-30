import { spawnSync } from "node:child_process";

function firstEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  return "";
}

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = firstEnv(["POSTGRES_HOST", "DATABASE_HOST", "DB_HOST"]);
  const port = firstEnv(["POSTGRES_PORT", "DATABASE_PORT", "DB_PORT"]) || "5432";
  const database = firstEnv(["POSTGRES_DB", "DATABASE_NAME", "DB_NAME"]);
  const user = firstEnv(["POSTGRES_USER", "DATABASE_USER", "DB_USER"]);
  const password = firstEnv(["POSTGRES_PASSWORD", "DATABASE_PASSWORD", "DB_PASSWORD"]);

  if (!host || !database || !user || !password) {
    const missing = [];
    if (!host) missing.push("POSTGRES_HOST");
    if (!database) missing.push("POSTGRES_DB");
    if (!user) missing.push("POSTGRES_USER");
    if (!password) missing.push("POSTGRES_PASSWORD");

    console.error("DATABASE_URL is required.");
    console.error("Add DATABASE_URL in Amvera Variables, or add these variables:");
    console.error(missing.join(", "));
    process.exit(1);
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?schema=public`;
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const databaseUrl = buildDatabaseUrl();
const safeDatabaseUrl = databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl
};

console.log(`Using DATABASE_URL: ${safeDatabaseUrl}`);
run("npx", ["prisma", "migrate", "deploy"], env);
run("node", ["dist/server.js"], env);
