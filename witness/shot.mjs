#!/usr/bin/env node
// shot.mjs — one press photo: two strangers paired live, a little conversation,
// the classic chrome. Writes holoroulette.png next to the repo README.
//   node witness/shot.mjs [port]

import { createRequire } from "node:module";
import { startRelay } from "./signal-relay.mjs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = createRequire("C:/Users/pavel/Desktop/HOLOGRAM/holo-os/system/")("playwright")); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = +(process.argv[2] || 8977);
const server = await startRelay(PORT);
const base = `http://127.0.0.1:${PORT}`;

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const open = async (id) => {
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 720 } })).newPage();
  await page.goto(`${base}/web/index.html?door=relay&id=${id}&testpattern=1`);
  return page;
};
const A = await open("stranger-1");
const B = await open("stranger-2");
for (const p of [A, B]) await p.waitForFunction(() => window.state.status === "connected", null, { timeout: 30000 });
await sleep(1500);
await B.evaluate(() => window.sendChat("BILLGATES"));
await sleep(400);
await B.evaluate(() => window.sendChat("ure bill gates?"));
await sleep(400);
await A.evaluate(() => window.sendChat("no my camera is broken"));
await sleep(400);
await B.evaluate(() => window.sendChat("JAJAJAJA"));
await sleep(1200);
await A.screenshot({ path: new URL("../holoroulette.png", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
await browser.close();
server.close();
console.log("wrote holoroulette.png");
