// session.mjs — the pair: two strangers, one private door, one fabric.
//
// The offerer minted `room` (128-bit hex). Both derive from it, independently:
//   · the pair DOOR (sealed frames on an unguessable broker topic — SDP/ICE only)
//   · the pair KEY  (AES-GCM) for the fabric — every chat line, typing beacon
//     and video frame crosses as a κ-ADDRESSED, E2E-ENCRYPTED object that the
//     receiving side re-derives and verifies before it plays (holo-fabric).
// The byte pipe under the fabric is a single data channel (the fabric is
// transport-agnostic; perfect-negotiation idiom of televoid web/link.mjs,
// incl. the restartIce retry for a lost first offer).
//
//   const s = await openPair({ door, room, self, partner, initiator, onObject, onOpen, onClose });
//   s.send({ t: "chat", text }) · s.send({ t: "vf", seq }, jpegBytes) · s.close()

import { makeFabric } from "../vendor/holo-fabric.mjs";
import { pack, unpack } from "./wire.mjs";

const te = new TextEncoder();

async function pairKey(room) {
  const raw = await crypto.subtle.digest("SHA-256", te.encode(room + "|pairkey"));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function openPair({ door, room, self, partner, initiator,
  ice = [{ urls: "stun:stun.l.google.com:19302" }],
  onObject = () => {}, onOpen = () => {}, onClose = () => {} } = {}) {

  const key = await pairKey(room);
  const fabric = makeFabric({ key, onObject: (pt, { kappa }) => {
    const m = unpack(pt);
    if (m) onObject(m.hdr, m.body, kappa);
  } });

  let closed = false, opened = false;
  const pc = new RTCPeerConnection({ iceServers: ice });
  const st = { dc: null, link: null, makingOffer: false };

  const sig = await door("pair-" + room, self, onSignal);

  pc.onicecandidate = ({ candidate }) => { if (candidate) sig.post({ kind: "ice", data: candidate }); };
  pc.onnegotiationneeded = async () => {
    try { st.makingOffer = true; await pc.setLocalDescription(); sig.post({ kind: "sdp", data: pc.localDescription }); }
    catch {} finally { st.makingOffer = false; }
  };
  pc.onconnectionstatechange = () => {
    if (["failed", "closed", "disconnected"].includes(pc.connectionState) && opened && !closed) finish();
  };

  function wireDc(dc) {
    dc.binaryType = "arraybuffer";
    const link = { send: (buf) => { try { if (dc.readyState === "open") dc.send(buf); } catch {} }, onMessage: null, close: () => {} };
    st.dc = dc; st.link = link;
    dc.onopen = () => { opened = true; fabric.addLink(link); onOpen(); };
    dc.onmessage = (e) => { link.onMessage && link.onMessage(e.data); };
    dc.onclose = () => { if (opened && !closed) finish(); };
  }

  async function onSignal(m) {
    if (closed || !m) return;
    if (m.kind === "ice") { try { await pc.addIceCandidate(m.data); } catch {} }
    else if (m.kind === "sdp") {
      const polite = !initiator;
      const collision = m.data.type === "offer" && (st.makingOffer || pc.signalingState !== "stable");
      if (!polite && collision) return;
      try {
        await pc.setRemoteDescription(m.data);
        if (m.data.type === "offer") { await pc.setLocalDescription(); sig.post({ kind: "sdp", data: pc.localDescription }); }
      } catch {}
    }
  }

  if (initiator) {
    wireDc(pc.createDataChannel("pair", { ordered: true }));
    // a lost offer is re-issued: until the channel opens, restart ICE a few times
    let tries = 0;
    const iv = setInterval(() => {
      if (closed || (st.dc && st.dc.readyState === "open") || ++tries > 5) return clearInterval(iv);
      try { pc.restartIce(); } catch {}
    }, 3000);
  } else {
    pc.ondatachannel = (e) => wireDc(e.channel);
  }

  function finish() {
    if (closed) return;
    closed = true;
    try { st.link && fabric.removeLink(st.link); } catch {}
    try { pc.close(); } catch {}
    sig.close();
    onClose();
  }

  return {
    partner, room,
    isOpen: () => opened && !closed && st.dc && st.dc.readyState === "open",
    send: async (hdr, body) => { if (!closed) { try { return await fabric.publish(pack(hdr, body)); } catch {} } },
    stats: () => fabric.stats(),
    close: (silent = false) => {
      if (!closed && !silent && st.dc && st.dc.readyState === "open") {
        fabric.publish(pack({ t: "bye" })).catch(() => {});
      }
      setTimeout(finish, 60);       // let the goodbye leave the building
    },
  };
}
