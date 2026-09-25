// Public Next.js custom-server API avoids the CLI's child-process IPC launcher.
// This local-only runner is not the production deployment entry point.
import { createServer } from "node:http";
import next from "next";

process.env.RESQ_PROVIDER = "demo";
const port = Number(process.env.PORT || 3000);
const hostname = "127.0.0.1";
const app = next({ dev: true, hostname, port, webpack: true });
await app.prepare();
const handle = app.getRequestHandler();
const server = createServer((req, res) => {
  handle(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500);
    res.end("Request failed.");
  });
});
server.on("upgrade", app.getUpgradeHandler());
server.on("error", (error) => { console.error(error.message); process.exit(1); });
server.listen(port, hostname, () => console.log(`ResQ deterministic demo ready: http://${hostname}:${port} (no AWS calls)`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => {
  server.close();
  await app.close();
  process.exit(0);
});
