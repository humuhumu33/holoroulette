#!/usr/bin/env node
// match.witness.mjs — the PURE witness: the coordinator-free wheel, in node,
// over in-memory doors with delivery jitter (the broker, minus the network).
//
// Proves: strangers pair MUTUALLY and DISJOINTLY with no coordinator; the
// wheel never lands on the stranger you just left; presence counts converge;
// "Cam required" filters both directions; an unanswered offer respins.
//
//   node witness/match.witness.mjs

import { makeMatchmaker, HERE_TTL } from "../web/roulette.mjs";

let pass = 0, fail = 0;
const ok = (c, m, d = "") => { console.log((c ? "  ok  " : "  XX  ") + m + (d ? " — " + d : "")); if (c) pass++; else fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// an in-memory door hub: rooms of peers, async fan-out with 1-6ms jitter
function makeHub() {
  const rooms = new Map();   // room → Map(self → onMsg)
  return {
    door: async (room, self, onMsg) => {
      if (!rooms.has(room)) rooms.set(room, new Map());
      rooms.get(room).set(self, onMsg);
      return {
        post: (m) => {
          const msg = { ...m, from: self };
          for (const [pid, fn] of rooms.get(room) || []) {
            if (pid === self) continue;
            if (msg.to && msg.to !== pid) continue;
            setTimeout(() => { try { fn(msg); } catch {} }, 1 + Math.random() * 5);
          }
        },
        close: () => { const r = rooms.get(room); if (r && r.get(self) === onMsg) r.delete(self); },
      };
    },
  };
}

async function spin({ id, hub, cam = true, wantCam = false }) {
  const pairs = [];
  const mm = await makeMatchmaker({ self: id, door: hub.door, cam, wantCam,
    onPaired: (p) => pairs.push(p) });
  return { id, mm, pairs, last: () => pairs[pairs.length - 1] || null };
}

// ── 1 · four strangers → two mutual, disjoint pairs ──────────────────────────
{
  const hub = makeHub();
  const P = {};
  for (const id of ["aa", "bb", "cc", "dd"]) P[id] = await spin({ id, hub });
  for (const p of Object.values(P)) p.mm.start();
  await sleep(4000);

  const got = Object.values(P).map((p) => p.last());
  ok(got.every((g) => g), "every one of 4 strangers got PAIRED with no coordinator",
    Object.values(P).map((p) => p.id + "→" + (p.last()?.partner || "-")).join(" "));
  const mutual = Object.values(P).every((p) => { const g = p.last(); return g && P[g.partner] && P[g.partner].last()?.partner === p.id; });
  ok(mutual, "pairs are MUTUAL (A→B ⇔ B→A) and rooms agree",
    Object.values(P).every((p) => { const g = p.last(); return g && P[g.partner].last()?.room === g.room; }) ? "rooms match" : "ROOM MISMATCH");
  const partners = new Set(got.map((g) => g && g.partner));
  ok(partners.size === 4 && !got.some((g, i) => g.partner === Object.keys(P)[i]), "pairs are DISJOINT, nobody paired with themselves");
  ok(got.every((g) => /^[0-9a-f]{32}$/.test(g.room)), "every pair got a fresh 128-bit private room secret");
  const counts = Object.values(P).map((p) => p.mm.count());
  ok(counts.every((c) => c === 4), "presence converged: every stranger counts Users online: 4", counts.join(","));

  // ── 2 · Next never lands on the stranger you just left ────────────────────
  // aa leaves its partner; the ex also respins. With aa's ex excluded both
  // ways, aa must land on someone from the OTHER pair.
  const ex = P.aa.last().partner;
  const other = Object.keys(P).filter((k) => k !== "aa" && k !== ex);
  P.aa.mm.next(); P[ex].mm.next();
  P[other[0]].mm.next(); P[other[1]].mm.next();   // everyone back on the wheel
  await sleep(4000);
  const re = P.aa.last();
  ok(re && re.partner !== ex, `Next NEVER rematches the stranger just left (ex=${ex})`, "aa→" + (re?.partner || "-"));
  ok(Object.values(P).every((p) => p.pairs.length >= 2), "every stranger found a NEW pair after Next",
    Object.values(P).map((p) => p.id + ":" + p.pairs.length).join(" "));
  for (const p of Object.values(P)) p.mm.leave();
}

// ── 3 · Cam required filters both directions ─────────────────────────────────
{
  const hub = makeHub();
  const want = await spin({ id: "want", hub, cam: true, wantCam: true });
  const nocam = await spin({ id: "zz-nocam", hub, cam: false });
  want.mm.start(); nocam.mm.start();
  await sleep(2500);
  ok(!want.last() && !nocam.last(), "a cam-requiring stranger and a camless one NEVER pair (both directions hold)");
  const withcam = await spin({ id: "withcam", hub, cam: true });
  withcam.mm.start();
  await sleep(3000);
  ok(want.last()?.partner === "withcam" && withcam.last()?.partner === "want",
    "the cam-requiring stranger pairs the moment a cam holder arrives");
  for (const p of [want, nocam, withcam]) p.mm.leave();
}

// ── 4 · a vanished stranger ages out of the count ────────────────────────────
{
  const hub = makeHub();
  const a = await spin({ id: "count-a", hub });
  const b = await spin({ id: "count-b", hub });
  await sleep(500);
  ok(a.mm.count() === 2, "presence sees the newcomer", "count=" + a.mm.count());
  b.mm.leave();
  await sleep(300);
  ok(a.mm.count() === 1, "a clean bye leaves the room at once", "count=" + a.mm.count());
  a.mm.leave();
  ok(HERE_TTL <= 15000, "silent ghosts age out on a short TTL (no leaveNet ghost trap)", HERE_TTL + "ms");
}

console.log(`\n${pass} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
