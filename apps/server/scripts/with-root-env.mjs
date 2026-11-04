import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

const rootEnv = resolve(process.cwd(), "../../.env");
const localEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) config({ path: rootEnv });
if (existsSync(localEnv)) config({ path: localEnv });

const args = process.argv.slice(2);
const allowPlaceholder = args[0] === "--allow-placeholder";
const command = allowPlaceholder ? args.slice(1) : args;
if (allowPlaceholder && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://karaoke:karaoke@localhost:5432/karaoke?schema=public";
}
if (command.length === 0) {
  console.error("Thiếu lệnh sau with-root-env.");
  process.exit(1);
}

const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(result.status ?? 1);
