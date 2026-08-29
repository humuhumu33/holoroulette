#!/usr/bin/env node
// ux.witness.mjs — the AUTHENTICITY witness: the chrome must read like 2010.
// Every control, label and behavior of the classic layout, asserted in the DOM:
// the pills, the F keys, the checkbox sets, the Partner/You stack, the gray
// chrome, the status log voice. If a rebrand or refactor drifts the feel, this
// witness goes red before a person ever has to squint.
//
//   node witness/ux.witness.mjs [port]

import { createRequire } from "node:module";
import { startRelay } from "./signal-relay.mjs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = createRequire("C:/Users/pavel/Desktop/HOLOGRAM/holo-os/system/")("playwright")); }

let pass = 0, fail = 0;
const ok = (c, m, d = "") => { console.log((c ? "  ok  " : "  XX  ") + m + (d ? " — " + d : "")); if (c) pass++; else fail++; };

const PORT = +(process.argv[2] || 8976);
const server = await startRelay(PORT);
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(`http://127.0.0.1:${PORT}/web/index.html?door=relay&nocam=1&id=ux-1`);
await page.waitForFunction(() => window.state && window.state.status, null, { timeout: 10000 });

const T = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent.trim(), sel);

// ── the header: three pills, two checkboxes, the count ───────────────────────
ok(await T("#btnNext") === "Next (F9)", "the first pill is “Next (F9)”", await T("#btnNext"));
ok(await T("#btnStop") === "Stop (F8)", "the second pill is “Stop (F8)”", await T("#btnStop"));
ok(await T("#btnReport") === "Report", "the third pill is “Report”");
ok(await T("#lbAuto") === "Auto reconnect" && await T("#lbCam") === "Cam required",
  "header checkboxes: Auto reconnect · Cam required");
ok(/^Users online: \d+$/.test(await T("#online")), "the count reads “Users online: N”", await T("#online"));
const pill = await page.evaluate(() => { const b = document.querySelector("#btnNext"); const c = getComputedStyle(b);
  return { radius: c.borderRadius, grad: c.backgroundImage.includes("gradient") }; });
ok(pill.radius === "12px" && pill.grad, "the buttons are era pills: rounded, gradient-filled", JSON.stringify(pill));

// ── the left stack: Partner over You, 320×240 each, the option row, the links ─
ok(await T("#lbPartner") === "Partner" && await T("#lbYou") === "You", "video labels read “Partner” / “You”");
const boxes = await page.evaluate(() => [...document.querySelectorAll(".vbox")].map((b) => {
  const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
ok(boxes.length === 2 && boxes.every(([w, h]) => w === 320 && h === 240), "both video panes are 320×240 — the classic 4:3 frame", JSON.stringify(boxes));
const above = await page.evaluate(() => {
  const p = document.querySelectorAll(".vbox")[0].getBoundingClientRect();
  const y = document.querySelectorAll(".vbox")[1].getBoundingClientRect();
  return p.bottom <= y.top;
});
ok(above, "Partner sits ABOVE You (the stack, not side by side)");
ok(await T("#lbStart") === "Auto start" && await T("#lbClean") === "Clean chatlog" && await T("#lbSound") === "Chat sounds",
  "the under-video options: Auto start · Clean chatlog · Chat sounds");
ok(await T("#lnLayout") === "Different layout" && await T("#lnAgree") === "Agreement" && await T("#lnContact") === "Contacts",
  "the three little links: Different layout · Agreement · Contacts");

// ── the chat side: white log, the voice, the typing whisper, the input ───────
const chrome = await page.evaluate(() => ({
  body: getComputedStyle(document.body).backgroundColor,
  log: getComputedStyle(document.querySelector("#log")).backgroundColor,
  sysItalic: getComputedStyle(document.querySelector("#log .sys")).fontStyle,
}));
ok(chrome.body === "rgb(233, 233, 233)" && chrome.log === "rgb(255, 255, 255)",
  "gray chrome, white chat box — the era palette", JSON.stringify(chrome));
ok(chrome.sysItalic === "italic", "status lines whisper in italics");
ok(await page.evaluate(() => [...document.querySelectorAll("#log .sys")].some((d) => d.textContent.includes("Looking for a random stranger"))),
  "on entry the log says it is looking for a random stranger");
ok(await T("#typing") === "Your partner is typing", "the typing whisper is “Your partner is typing”");
ok(await page.evaluate(() => document.querySelector("#say").tagName === "TEXTAREA"), "the message box is the wide low textarea");

// ── the keys: F9 spins, F8 stops ─────────────────────────────────────────────
await page.keyboard.press("F8");
await page.waitForFunction(() => window.state.status === "stopped", null, { timeout: 3000 }).catch(() => {});
ok(await page.evaluate(() => window.state.status === "stopped"), "F8 STOPS the wheel");
await page.keyboard.press("F9");
await page.waitForFunction(() => window.state.status === "seeking", null, { timeout: 3000 }).catch(() => {});
ok(await page.evaluate(() => window.state.status === "seeking"), "F9 SPINS again");
ok(await page.evaluate(() => [...document.querySelectorAll("#log .sys")].some((d) => d.textContent.includes("Stopped. Press"))),
  "stopping told you so in the log, the polite way");

await browser.close();
server.close();
console.log(`\n${pass} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
