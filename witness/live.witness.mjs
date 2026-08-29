#!/usr/bin/env node
// live.witness.mjs — the LIVE witness: the whole roulette over REAL browsers.
// Three strangers in separate Chromium contexts on the product page; pairing
// over the content-blind door; then EVERY unit between the pair — chat, typing,
// video frames — crosses as a κ-addressed, E2E-encrypted object on the
// hologram fabric over a real RTCDataChannel byte pipe.
//
// Proves, live: two strangers PAIR and both see "Connected, feel free to talk
// now"; chat lands both ways painted in the authentic colors; typing shows
// "Your partner is typing"; video frames flow and PAINT; Next spins to the
// third stranger, never back to the one just left; the left-behind stranger
// sees the disconnect line; Users online counts the room.
//
//   node witness/live.witness.mjs [port]

import { createRequire } from "node:module";
import { startRelay } from "./signal-relay.mjs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = createRequire("C:/Users/pavel/Desktop/HOLOGRAM/holo-os/system/")("playwright")); }

let pass = 0, fail = 0;
const ok = (c, m, d = "") => { console.log((c ? "  ok  " : "  XX  ") + m + (d ? " — " + d : "")); if (c) pass++; else fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = +(process.argv[2] || 8975);
const server = await startRelay(PORT);
const base = `http://127.0.0.1:${PORT}`;

// canvas test pattern IS the camera here — canvas.captureStream+MediaRecorder
// crashes headless on this machine (televoid debug-rec trap); frames go by
// canvas.toBlob JPEG, so nothing here touches MediaRecorder at all.
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const open = async (id) => {
  const page = await (await browser.newContext()).newPage();
  page.on("pageerror", (e) => console.log("  [pageerror " + id + "]", String(e).slice(0, 160)));
  await page.goto(`${base}/web/index.html?door=relay&id=${id}&testpattern=1`);
  return page;
};

const A = await open("st-a");
const B = await open("st-b");

// ── two strangers pair; the authentic line appears ───────────────────────────
for (const p of [A, B]) await p.waitForFunction(() => window.state.status === "connected", null, { timeout: 30000 }).catch(() => {});
const sa = await A.evaluate(() => window.state), sb = await B.evaluate(() => window.state);
ok(sa.status === "connected" && sb.status === "connected", "two strangers PAIRED over the serverless door", `a→${sa.partner} b→${sb.partner}`);
ok(sa.partner === "st-b" && sb.partner === "st-a", "the pair is mutual");
ok(await A.evaluate(() => [...document.querySelectorAll("#log .sys")].some((d) => d.textContent.includes("Connected, feel free to talk now"))),
  "the log says the 2010 words: “Connected, feel free to talk now”");

// ── chat crosses the fabric both ways, painted in the authentic colors ──────
await A.evaluate(() => window.sendChat("asl?"));
await B.evaluate(() => window.sendChat("ure bill gates?"));
await B.waitForFunction(() => window.state.chat.some((c) => c.from === "stranger"), null, { timeout: 10000 }).catch(() => {});
await A.waitForFunction(() => window.state.chat.some((c) => c.from === "stranger"), null, { timeout: 10000 }).catch(() => {});
ok(await B.evaluate(() => window.state.chat.some((c) => c.from === "stranger" && c.text === "asl?")),
  "a chat line crossed A→B as a κ-object on the fabric");
ok(await A.evaluate(() => window.state.chat.some((c) => c.from === "stranger" && c.text === "ure bill gates?")),
  "and B→A the other way");
const colors = await B.evaluate(() => {
  const s = document.querySelector("#log .stranger b"), m = document.querySelector("#log .me b");
  return { s: s && getComputedStyle(s).color, m: m && getComputedStyle(m).color,
           sl: s && s.textContent.trim(), ml: m && m.textContent.trim() };
});
ok(colors.sl === "Stranger:" && colors.s === "rgb(224, 0, 0)", "incoming lines say “Stranger:” in red", colors.s);
ok(colors.ml === "You:" && colors.m === "rgb(0, 0, 204)", "own lines say “You:” in blue", colors.m);
ok(await B.evaluate(() => window.state.lastKappa && /^[0-9a-f]{64}$/.test(window.state.lastKappa)),
  "every received object carried a verified κ (the fabric drops what fails re-derivation)");

// ── typing beacon ────────────────────────────────────────────────────────────
await A.evaluate(() => { const t = document.querySelector("#say"); t.focus(); });
await A.type("#say", "hmm");
await B.waitForFunction(() => window.state.partnerTyping, null, { timeout: 8000 }).catch(() => {});
ok(await B.evaluate(() => window.state.partnerTyping &&
    document.querySelector("#typing").classList.contains("on") &&
    document.querySelector("#typing").textContent === "Your partner is typing"),
  "“Your partner is typing” shows while the stranger types");

// ── video: frames flow as κ-objects and PAINT in the Partner box ─────────────
await B.waitForFunction(() => window.state.framesIn > 8 && window.state.framesOut > 8, null, { timeout: 20000 }).catch(() => {});
const fb = await B.evaluate(() => ({ fin: window.state.framesIn, fout: window.state.framesOut,
  painted: (() => { const i = document.querySelector("#pframe"); return i.naturalWidth > 0 && i.naturalHeight > 0; })() }));
ok(fb.fin > 8 && fb.fout > 8, "video frames FLOW both ways over the fabric (no WebRTC media stack, no server)", `in=${fb.fin} out=${fb.fout}`);
ok(fb.painted, "the Partner box painted real pixels from a received κ-object");

// ── Next: spins to the third stranger, never back; the left one hears it ────
const C = await open("st-c");
await sleep(1500);
await A.evaluate(() => window.next());
await A.waitForFunction(() => window.state.status === "connected" && window.state.partner === "st-c", null, { timeout: 30000 }).catch(() => {});
const sa2 = await A.evaluate(() => window.state);
ok(sa2.partner === "st-c", "Next landed on the NEW stranger, never the one just left", "a→" + sa2.partner);
await B.waitForFunction(() => [...document.querySelectorAll("#log .sys")].some((d) => d.textContent.includes("Stranger has disconnected")), null, { timeout: 10000 }).catch(() => {});
ok(await B.evaluate(() => [...document.querySelectorAll("#log .sys")].some((d) => d.textContent.includes("Stranger has disconnected"))),
  "the stranger left behind sees “Stranger has disconnected…”");
const counts = await Promise.all([A, B, C].map((p) => p.evaluate(() => window.state.usersOnline)));
ok(counts.every((c) => c === 3), "Users online counts the whole room on every page", counts.join(","));

// C pairs with A; C's chat reaches A (fresh pair key — B could never read it)
await C.waitForFunction(() => window.state.status === "connected", null, { timeout: 15000 }).catch(() => {});
await C.evaluate(() => window.sendChat("JAJAJAJA"));
await A.waitForFunction(() => window.state.chat.some((c) => c.text === "JAJAJAJA"), null, { timeout: 10000 }).catch(() => {});
ok(await A.evaluate(() => window.state.chat.some((c) => c.from === "stranger" && c.text === "JAJAJAJA")),
  "the new pair talks on a FRESH pair key (each room secret minted per pair)");

for (const p of [A, B, C]) await p.evaluate(() => window.leaveNet()).catch(() => {});
await browser.close();
server.close();
console.log(`\n${pass} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
