#!/usr/bin/env node
// broker.witness.mjs — the PRODUCTION-DOOR witness: two strangers over the REAL
// public MQTT brokers, no local signal endpoint at all. This is the exact path
// a visitor to the live page takes — the leg the relay-door witnesses cannot
// see. Born of a live hang: a post made before CONNACK+SUBACK was silently
// dropped, taking the first SDP offer with it; the door now queues until it
// can speak, and this witness holds that door shut against regression.
//
// Needs the internet (broker.emqx.io / broker.hivemq.com). ~30-60s.
//
//   node witness/broker.witness.mjs [port]

import { createRequire } from "node:module";
import { startRelay } from "./signal-relay.mjs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = createRequire("C:/Users/pavel/Desktop/HOLOGRAM/holo-os/system/")("playwright")); }

let pass = 0, fail = 0;
const ok = (c, m, d = "") => { console.log((c ? "  ok  " : "  XX  ") + m + (d ? " — " + d : "")); if (c) pass++; else fail++; };

const PORT = +(process.argv[2] || 8978);
const server = await startRelay(PORT);          // static files only — /signal is never called here
const base = `http://127.0.0.1:${PORT}`;
const run = Math.random().toString(36).slice(2, 8);   // fresh ids per run — the lobby is the real, shared one

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const open = async (id) => {
  // real origin BEFORE sockets: a WebSocket from about:blank silently errors headless
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${base}/web/index.html?id=${id}&testpattern=1&lobby=bw-${run}`);
  return page;
};

const A = await open("bw-a-" + run);
const B = await open("bw-b-" + run);

for (const p of [A, B]) await p.waitForFunction(() => window.state.status === "connected", null, { timeout: 60000 }).catch(() => {});
const sa = await A.evaluate(() => window.state), sb = await B.evaluate(() => window.state);
ok(sa.status === "connected" && sb.status === "connected",
  "two strangers PAIRED over the REAL public brokers (no local signaling at all)", `a→${sa.partner} b→${sb.partner}`);
ok(sa.partner === "bw-b-" + run && sb.partner === "bw-a-" + run, "the pair is mutual");

await A.evaluate(() => window.sendChat("hello from the void"));
await B.waitForFunction(() => window.state.chat.some((c) => c.from === "stranger"), null, { timeout: 15000 }).catch(() => {});
ok(await B.evaluate(() => window.state.chat.some((c) => c.from === "stranger" && c.text === "hello from the void")),
  "chat crossed the pair fabric whose SDP rode sealed broker frames");
await B.waitForFunction(() => window.state.framesIn > 3, null, { timeout: 20000 }).catch(() => {});
ok(await B.evaluate(() => window.state.framesIn > 3), "video frames flow on the broker-doored pair",
  "framesIn=" + await B.evaluate(() => window.state.framesIn));

for (const p of [A, B]) await p.evaluate(() => window.leaveNet()).catch(() => {});
await browser.close();
server.close();
console.log(`\n${pass} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
