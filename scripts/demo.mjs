import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../frontend/", import.meta.url));
if (!existsSync(new URL("../frontend/node_modules/next/package.json", import.meta.url))) {
  const install = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--ignore-scripts"], {
    cwd, stdio: "inherit", shell: process.platform === "win32",
  });
  if (install.error || install.status !== 0) process.exit(install.status || 1);
}
const run = spawnSync(process.execPath, ["scripts/demo-server.mjs"], {
  cwd, stdio: "inherit", env: { ...process.env, RESQ_PROVIDER: "demo" },
});
if (run.error) console.error(run.error.message);
process.exit(run.status || (run.error ? 1 : 0));
