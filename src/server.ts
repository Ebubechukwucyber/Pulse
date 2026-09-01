import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bus } from "./bus.ts";
import { playCheckoutDemo } from "./replay.ts";
import { liveStatus } from "./live.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ui = join(root, "ui");
const port = Number(process.env.PULSE_PORT ?? 8787);
const mode = process.argv.includes("--mode")
  ? process.argv[process.argv.indexOf("--mode") + 1]
  : "replay";

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
};

const httpServer = createServer((req, res) => {
  const url = req.url ?? "/";

  if (url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, mode, events: bus.log.length }));
    return;
  }

  if (url === "/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
    });
    res.write("\n");
    bus.attachSse(res);
    return;
  }

  if (url === "/api/replay" && req.method === "POST") {
    void playCheckoutDemo();
    res.writeHead(202).end("replay-started");
    return;
  }

  let path = url === "/" ? "/index.html" : url.split("?")[0];
  const file = join(ui, path.replace(/^\//, ""));
  if (!file.startsWith(ui) || !existsSync(file)) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": mime[extname(file)] ?? "text/plain" });
  res.end(readFileSync(file));
});

httpServer.listen(port, () => {
  console.log(`PULSE ${mode}  http://localhost:${port}`);
  if (mode === "live") console.log(liveStatus());
  void playCheckoutDemo();
});
