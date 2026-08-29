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
const withCtl = await page.evaluate(() => ({
  label: document.querySelector("#lbWithText").textContent,
  options: [...document.querySelectorAll("#selWith option")].map((o) => o.textContent),
  value: document.querySelector("#selWith").value,
}));
ok(withCtl.label === "Chat with:" && withCtl.options.join("·") === "Humans·AI·Both",
  "the wheel chooser reads “Chat with: Humans · AI · Both”", JSON.stringify(withCtl.options));
ok(withCtl.value === "both", "and Both is the default — the wheel takes whoever comes");
await page.selectOption("#selWith", "ai");
ok(await page.evaluate(() => window.state.wants === "ai"),
  "flipping it retargets the live matchmaker (state.wants follows)");
await page.selectOption("#selWith", "both");
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
  logRadius: getComputedStyle(document.querySelector("#log")).borderRadius,
  font: getComputedStyle(document.body).fontFamily,
  sysItalic: getComputedStyle(document.querySelector("#log .sys")).fontStyle,
}));
ok(chrome.body === "rgb(242, 242, 242)" && chrome.log === "rgb(255, 255, 255)",
  "gray chrome, white chat box — the era palette", JSON.stringify({ body: chrome.body, log: chrome.log }));
ok(chrome.logRadius === "0px" && /Arial/.test(chrome.font),
  "square chat panes, Arial — the Flash-era text look (only the pills are round)");
ok(chrome.sysItalic === "italic", "status lines whisper in italics");
ok(await page.evaluate(() => !document.querySelector("#foot") &&
    ![...document.querySelectorAll("body *")].some((e) => e.childElementCount === 0 && /fabric|serverless/i.test(e.textContent))),
  "no footer ad line, no tech talk — nothing the 2010 page would not say");
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

// ── mobile: one column, two pictures side by side, chat still breathing ──────
const mob = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await mob.goto(`http://127.0.0.1:${PORT}/web/index.html?door=relay&nocam=1&id=ux-m`);
await mob.waitForFunction(() => window.state && window.state.status, null, { timeout: 10000 });
const M = await mob.evaluate(() => {
  const r = (s) => document.querySelector(s).getBoundingClientRect();
  const bp = r("#boxP"), by = r("#boxY"), log = r("#log"), say = r("#say"), next = r("#btnNext");
  return {
    noHScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
    sideBySide: Math.abs(bp.top - by.top) < 2 && bp.right <= by.left + 1,
    aspect: Math.abs(bp.width / bp.height - 4 / 3) < 0.02,
    fitsWidth: by.right <= window.innerWidth + 1,
    smallPrintHidden: getComputedStyle(document.querySelector("#leftOpts")).display === "none"
                   && getComputedStyle(document.querySelector("#leftLinks")).display === "none",
    withVisible: (() => { const r = document.querySelector("#selWith").getBoundingClientRect();
      return r.width > 0 && r.right <= window.innerWidth + 1; })(),
    logVisible: log.height > 120 && log.top > by.bottom,
    sayOnScreen: say.bottom <= window.innerHeight + 1,
    sayFont: getComputedStyle(document.querySelector("#say")).fontSize,
    pillTappable: next.height >= 30,
  };
});
ok(M.noHScroll, "mobile: the page never scrolls sideways");
ok(M.sideBySide && M.aspect && M.fitsWidth, "mobile: Partner and You sit side by side, 4:3, inside the screen");
ok(M.smallPrintHidden, "mobile: the small print (options row, little links) stays off small screens");
ok(M.withVisible, "mobile: the Chat with chooser stays on screen (it picks who you meet)");
ok(M.logVisible && M.sayOnScreen, "mobile: the chat log breathes below the pictures and the input stays on screen");
ok(M.sayFont === "16px", "mobile: 16px input — iOS will not zoom the page on focus", M.sayFont);
ok(M.pillTappable, "mobile: the pills are finger-sized");
await mob.keyboard.press("F9");   // the keys still work where a keyboard exists
ok(await mob.evaluate(() => window.state.status === "seeking"), "mobile: the wheel still spins");

await browser.close();
server.close();
console.log(`\n${pass} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
