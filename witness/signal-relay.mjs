// signal-relay.mjs — a minimal content-blind signal door for the LIVE witness:
// SSE out (GET /signal?room&peer) + POST in, fan-out to the room. Same shape as
// televoid's witness relay. In production this rung IS the broker door
// (web/broker-door.mjs): sealed frames on derived topics over public MQTT —
// no server anyone operates. The interface is identical: post(msg) / onMsg(msg).
//
// Also serves ../web and ../vendor as static files (product path — the page the
// witness drives is the page a person would open).

import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const MIME = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json" };

export function startRelay(port) {
  const rooms = new Map(); // room → Map(peer → res)
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/signal") {
      const room = u.searchParams.get("room"), peer = u.searchParams.get("peer");
      if (req.method === "GET") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        res.write(":ok\n\n");
        if (!rooms.has(room)) rooms.set(room, new Map());
        rooms.get(room).set(peer, res);
        req.on("close", () => { const r = rooms.get(room); if (r && r.get(peer) === res) r.delete(peer); });
        return;
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          let msg; try { msg = JSON.parse(body); } catch { res.writeHead(400).end(); return; }
          msg.from = peer;
          if (process.env.RELAY_DEBUG) console.log("[sig]", room, peer, msg.kind, msg.to || "*");
          const r = rooms.get(room) || new Map();
          for (const [pid, out] of r) {
            if (pid === peer) continue;
            if (msg.to && msg.to !== pid) continue;
            try { out.write(`data: ${JSON.stringify(msg)}\n\n`); } catch {}
          }
          res.writeHead(200, { "content-type": "application/json" }).end("{}");
        });
        return;
      }
    }
    // static: /web/*, /vendor/*
    const fp = path.join(ROOT, u.pathname.replace(/^\//, ""));
    if (fp.startsWith(ROOT) && existsSync(fp) && !fp.endsWith(path.sep)) {
      try {
        res.writeHead(200, { "content-type": MIME[path.extname(fp)] || "application/octet-stream" });
        res.end(readFileSync(fp));
        return;
      } catch {}
    }
    res.writeHead(404).end("not found");
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

// run directly → a local demo host: node witness/signal-relay.mjs [port]
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("signal-relay.mjs")) {
  const port = +(process.argv[2] || 8080);
  await startRelay(port);
  console.log(`Holoroulette demo host on http://127.0.0.1:${port}
  open two tabs:  /web/index.html?door=relay&testpattern=1
  (production needs no host at all — the page over any static server uses public brokers)`);
}
