// roulette.mjs — SERVERLESS random matchmaking: the roulette wheel with no
// croupier. Every player sits on ONE shared lobby door (sealed frames over
// public brokers — the broker is content-blind); pairing is decided by the
// players themselves, deterministically, with no coordinator:
//
//   presence   {kind:"here", cam}                 every HERE_MS → "Users online: N"
//   seeking    {kind:"seek", sid, cam, want, ex}  every SEEK_MS while unpaired
//   pairing    lower id hears an eligible seek → {kind:"offer", to, room}
//              offeree (still free) → {kind:"accept", to, room}; both are paired
//   leaving    {kind:"bye"}
//
// `room` is a fresh 128-bit secret minted by the offerer: it names the PRIVATE
// pair door AND derives the pair's AES key — the lobby never learns what the
// two strangers say. `ex` is the previous partner: the wheel never lands on the
// stranger you just left (both directions checked). One outstanding offer at a
// time; an unanswered offer times out and the seek resumes — no deadlock, no
// state anyone else must clean up.
//
// DOM-free and RTC-free on purpose: the pure witness spins real matchmakers in
// node over in-memory doors. The browser session (session.mjs) sits above.

const randHex = (n = 32) => {
  const u = new Uint8Array(n / 2);
  (globalThis.crypto || require("node:crypto").webcrypto).getRandomValues(u);
  return Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");
};

export const HERE_MS = 3000;     // presence beacon period
export const HERE_TTL = 10000;   // a member silent this long is gone
export const SEEK_MS = 1000;     // seek beacon period
export const OFFER_TTL = 2500;   // an unanswered offer dies

export async function makeMatchmaker({
  self, door, lobby = "lobby",
  cam = false,                    // do I have a camera?
  wantCam = false,                // "Cam required" — only pair with cam holders
  onCount = () => {},             // (n) → users online, self included
  onPaired = () => {},            // ({ partner, room, initiator })
  onUnpaired = () => {},          // ({ partner, room }) — a pair dissolved before it opened
} = {}) {
  const members = new Map([[self, { ts: now(), cam }]]);   // id → { ts, cam }
  let seeking = false, sid = null, lastPartner = null, paired = null;
  let offer = null;               // { to, room, at } — one outstanding, mine
  let acceptedSid = null;         // the sid I already accepted an offer under
  let closed = false;
  function now() { return Date.now(); }

  const sig = await door(lobby, self, onMsg);

  function setPaired(partner, room, initiator) {
    paired = { partner, room };
    seeking = false; offer = null;
    onPaired({ partner, room, initiator });
  }

  function eligible(m) {
    if (m.from === self || paired || !seeking) return false;
    if (m.from === lastPartner || m.ex === self) return false;   // no instant rematch, either side
    if (wantCam && !m.cam) return false;                         // my requirement
    if (m.want && !cam) return false;                            // theirs
    return true;
  }

  function onMsg(m) {
    if (closed || !m || m.from === self) return;
    if (m.kind === "bye") { members.delete(m.from); tellCount(); return; }
    if (m.kind === "here" || m.kind === "seek") { members.set(m.from, { ts: now(), cam: !!m.cam }); tellCount(); }

    if (m.kind === "seek" && eligible(m) && self < m.from && (!offer || now() - offer.at > OFFER_TTL)) {
      offer = { to: m.from, room: randHex(32), at: now() };
      sig.post({ kind: "offer", to: m.from, room: offer.room, sid });
    } else if (m.kind === "offer" && m.to === self) {
      // accept the FIRST offer of this seek round, from anyone still eligible
      if (seeking && !paired && acceptedSid !== sid && m.from !== lastPartner && m.room) {
        acceptedSid = sid;
        sig.post({ kind: "accept", to: m.from, room: m.room });
        setPaired(m.from, m.room, false);
      }
    } else if (m.kind === "accept" && m.to === self) {
      if (seeking && !paired && offer && offer.to === m.from && offer.room === m.room) {
        setPaired(m.from, m.room, true);
      } else if (m.room && !(paired && paired.partner === m.from && paired.room === m.room)) {
        // I moved on before this accept landed — free the offeree at once
        // (the guard keeps a broker-duplicated accept from torpedoing a live pair)
        sig.post({ kind: "sorry", to: m.from, room: m.room });
      }
    } else if (m.kind === "sorry" && m.to === self) {
      if (paired && paired.partner === m.from && paired.room === m.room) {
        const was = paired; lastPartner = null;
        onUnpaired(was); seek();
      }
    }
  }

  function tellCount() { onCount(count()); }
  function count() {
    const t = now();
    for (const [id, v] of members) if (id !== self && t - v.ts > HERE_TTL) members.delete(id);
    return members.size;
  }

  const hereTimer = setInterval(() => {
    if (closed) return;
    members.set(self, { ts: now(), cam });
    sig.post({ kind: "here", cam });
    tellCount();
  }, HERE_MS);
  sig.post({ kind: "here", cam });

  const seekTimer = setInterval(() => {
    if (closed || !seeking || paired) return;
    if (offer && now() - offer.at > OFFER_TTL) offer = null;     // unanswered → spin again
    sig.post({ kind: "seek", sid, cam, want: wantCam, ex: lastPartner });
  }, SEEK_MS);

  function seek() {
    sid = randHex(16); acceptedSid = null; offer = null; paired = null;
    seeking = true;
    sig.post({ kind: "seek", sid, cam, want: wantCam, ex: lastPartner });
  }

  return {
    self,
    start: () => { if (!paired && !seeking) seek(); },
    // leave the current stranger (their session hears the fabric "bye") and spin again
    next: () => { if (paired) lastPartner = paired.partner; seek(); },
    stop: () => { if (paired) lastPartner = paired.partner; seeking = false; paired = null; offer = null; },
    // the pair door never opened (lost accept, dead RTC) → forget it and respin
    failPair: () => { if (paired) lastPartner = null; seek(); },
    setCam: (c) => { cam = c; },
    setWantCam: (w) => { wantCam = w; },
    count,
    state: () => ({ seeking, paired: paired && { ...paired }, lastPartner, members: members.size }),
    leave: () => { closed = true; clearInterval(hereTimer); clearInterval(seekTimer); sig.post({ kind: "bye" }); sig.close(); },
  };
}
