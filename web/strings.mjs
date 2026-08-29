// strings.mjs — the voice of the room, in one place. The 2010 chrome speaks
// exactly like this; the UX witness asserts these strings verbatim in the DOM.

export const NAME = "Holoroulette";

export const STR = {
  next: "Next (F9)",
  stop: "Stop (F8)",
  report: "Report",
  autoReconnect: "Auto reconnect",
  camRequired: "Cam required",
  usersOnline: (n) => "Users online: " + n,
  partner: "Partner",
  you: "You",
  autoStart: "Auto start",
  cleanChatlog: "Clean chatlog",
  chatSounds: "Chat sounds",
  differentLayout: "Different layout",
  agreement: "Agreement",
  contacts: "Contacts",
  strangerLabel: "Stranger:",
  youLabel: "You:",
  typing: "Your partner is typing",
  // system lines (italic, "> " prefixed, like the original status log)
  looking: "Looking for a random stranger who is online...",
  connected: "Connected, feel free to talk now",
  strangerLeft: "Stranger has disconnected. Press “Next” to find a new stranger",
  youLeft: "You have disconnected. Press “Next” to find a new stranger",
  stopped: "Stopped. Press “Next” to start",
  reported: "Stranger reported. Looking for a new stranger...",
  camMissing: "Your camera is off — strangers with “Cam required” will not see you",
  footer: "Serverless random chat on the Hologram κ fabric — no server behind this page",
};
