const $ = (id) => document.getElementById(id);

const ui = {
  sev: $("sev"),
  service: $("service"),
  brief: $("brief"),
  err: $("m-err"),
  p99: $("m-p99"),
  dep: $("m-dep"),
  clock: $("clock"),
  agents: $("agents"),
  sentry: $("sentry"),
  sentryState: $("sentry-state"),
  triage: $("triage"),
  triageState: $("triage-state"),
  arch: $("arch"),
  archState: $("arch-state"),
  hyp: $("hyp"),
  hypState: $("hyp-state"),
  fixer: $("fixer"),
  fixerState: $("fixer-state"),
  red: $("red-draft"),
  redState: $("red-state"),
  facts: $("facts"),
  overlap: $("overlap"),
  gantt: $("gantt"),
  status: $("status"),
};

const roster = new Set(["sentry", "triage"]);
const lastSeen = {};
const stamps = {};
const factsSeen = new Set();
let origin = 0;
let log = [];
let fixerText = "";
let veto = null;
let playing = true;
let killCamTimer = [];

function fmt(ms) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

setInterval(() => {
  if (!origin || !playing) return;
  ui.clock.textContent = fmt(Date.now() - origin);
  renderAgents();
  const live = Object.entries(lastSeen)
    .filter(([, t]) => Date.now() - t < 400)
    .map(([id]) => id);
  if (live.length >= 2) {
    ui.overlap.textContent = live.join(" + ");
    ui.overlap.className = "yes";
  }
}, 80);

function renderAgents() {
  ui.agents.innerHTML = [...roster]
    .map((id) => {
      const hot = Date.now() - (lastSeen[id] || 0) < 400;
      const isVeto = id === "redteam" && veto;
      return `<span class="${hot ? "hot" : ""} ${isVeto ? "veto" : ""}"><i></i><b>${id}</b></span>`;
    })
    .join("");
}

function mergeBlocks(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const blocks = [];
  for (const t of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && t - last.end < 450) last.end = t + 180;
    else blocks.push({ start: t, end: t + 180 });
  }
  return blocks;
}

function renderGantt() {
  const all = Object.values(stamps).flat();
  const max = Math.max(4000, ...all, 1);
  const order = ["sentry", "triage", "archaeologist", "hypothesis", "fixer", "redteam", "comms", "commander"];
  ui.gantt.innerHTML = Object.entries(stamps)
    .filter(([, times]) => times.length)
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([id, times]) => {
      const blocks = mergeBlocks(times)
        .map((b) => {
          const left = (b.start / max) * 100;
          const width = Math.max(1.2, ((b.end - b.start) / max) * 100);
          const cls = id === "redteam" ? "red" : "";
          return `<em class="${cls}" style="left:${left}%;width:${width}%"></em>`;
        })
        .join("");
      return `<div class="lane"><b>${id}</b><div class="track">${blocks}</div></div>`;
    })
    .join("");
}

function paintFixer() {
  if (!veto || !fixerText) {
    ui.fixer.textContent = fixerText;
    return;
  }
  const at = veto.atChar;
  const span = veto.dangerousSpan || "";
  const end = Math.min(fixerText.length, at + span.length);
  if (at < 0 || at >= fixerText.length) {
    ui.fixer.textContent = fixerText;
    return;
  }
  ui.fixer.innerHTML =
    esc(fixerText.slice(0, at)) +
    "<mark>" +
    esc(fixerText.slice(at, end)) +
    "</mark>" +
    esc(fixerText.slice(end));
}

function addFact(key, title, body) {
  if (factsSeen.has(key)) return;
  factsSeen.add(key);
  const el = document.createElement("div");
  el.className = "fact";
  el.innerHTML = `${esc(title)}<em>${esc(body)}</em>`;
  ui.facts.prepend(el);
}

function apply(ev, record) {
  if (record) log.push(ev);
  if (!origin) origin = Date.now() - (ev.t_ms || 0);

  const from = ev.from;
  if (from && from !== "system" && from !== "fixture") {
    roster.add(from);
    lastSeen[from] = Date.now();
    if (!stamps[from]) stamps[from] = [];
    stamps[from].push(ev.t_ms || 0);
  }
  ui.status.textContent = `${fmt(ev.t_ms || 0)}  ${ev.type} ← ${from}`;

  if (ev.type === "IncidentDeclared") {
    const p = ev.payload;
    ui.service.textContent = p.service;
    ui.brief.textContent = p.symptom;
    ui.err.textContent = `${p.errorRate}%`;
    ui.p99.textContent = `${p.p99ms}ms`;
    ui.dep.textContent = `${p.deployAgeMin}m`;
    if (ui.sentry) {
      ui.sentry.textContent = [p.service, p.symptom, ...(p.rawLines || [])].join("\n");
      ui.sentryState.textContent = "firing";
    }
  }
  if (ev.type === "SeveritySet") {
    ui.sev.textContent = ev.payload.sev;
    ui.sev.className = `sev ${ev.payload.sev}`;
    ui.brief.textContent = ev.payload.reason;
    if (ui.triage) {
      ui.triage.textContent = ev.payload.sev + "\n" + ev.payload.reason;
      ui.triageState.textContent = "set";
    }
  }
  if (ev.type === "RosterChanged") {
    for (const id of ev.payload.joined || []) roster.add(id);
    for (const id of ev.payload.left || []) roster.delete(id);
  }
  if (ev.type === "LoopStarted") {
    const role = ev.payload.role || ev.from;
    addFact("start:" + role + ":" + ev.t_ms, "START " + role, "t_ms " + ev.t_ms + " (bus clock)");
    ui.overlap.textContent = "start " + role + " @" + ev.t_ms + "ms";
    ui.overlap.className = "yes";
  }
  if (ev.type === "EvidenceFound") {
    addFact(`e:${ev.payload.path}:${ev.payload.quote}`, ev.payload.path, ev.payload.quote);
    if (ui.arch) {
      ui.arch.textContent = (ui.arch.textContent ? ui.arch.textContent + "\n\n" : "") + ev.payload.quote;
      ui.archState.textContent = "live";
    }
  }
  if (ev.type === "HypothesisPosted") {
    addFact(
      `h:${ev.payload.hid}`,
      `${ev.payload.hid}  ${Math.round((ev.payload.confidence || 0) * 100)}%`,
      ev.payload.claim || ev.payload.title
    );
    if (ui.hyp) {
      ui.hyp.textContent = ev.payload.claim || ev.payload.title || "";
      ui.hypState.textContent = "live";
    }
  }
  if (ev.type === "FixDraftDelta") {
    fixerText = ev.payload.fullSoFar;
    paintFixer();
    ui.fixerState.textContent = ev.payload.draftId === "draft-2" ? "pivot" : "streaming";
  }
  if (ev.type === "VetoIssued") {
    veto = ev.payload;
    paintFixer();
    ui.redState.textContent = "veto";
    ui.red.textContent =
      "stopped at char " +
      ev.payload.atChar +
      "\n" +
      ev.payload.reason +
      "\n" +
      ev.payload.dangerousSpan;
  }
  if (ev.type === "FixPivoted") {
    ui.red.textContent += "\n\nnext: " + ev.payload.to;
  }
  if (ev.type === "HumanDirective") {
    addFact("d:" + ev.payload.text, "commander", ev.payload.text);
    roster.add("commander");
  }
  if (ev.type === "StatusDrafted") {
    addFact("c:" + ev.payload.text, ev.payload.channel, ev.payload.text);
  }
  if (ev.type === "IncidentMitigated") {
    ui.sev.textContent = "MITIGATED";
    ui.sev.className = "sev ok";
    ui.brief.textContent = ev.payload.summary;
    ui.status.textContent = "mitigated";
  }
  renderAgents();
  renderGantt();
}

function resetView() {
  origin = 0;
  veto = null;
  fixerText = "";
  factsSeen.clear();
  log = [];
  Object.keys(stamps).forEach((k) => delete stamps[k]);
  Object.keys(lastSeen).forEach((k) => delete lastSeen[k]);
  roster.clear();
  roster.add("sentry");
  roster.add("triage");
  ui.fixer.textContent = "";
  ui.red.textContent = "";
  if (ui.arch) {
    ui.arch.textContent = "";
    ui.archState.textContent = "idle";
  }
  if (ui.hyp) {
    ui.hyp.textContent = "";
    ui.hypState.textContent = "idle";
  }
  ui.facts.innerHTML = "";
  ui.fixerState.textContent = "idle";
  ui.redState.textContent = "watching";
  ui.overlap.textContent = "waiting";
  ui.overlap.className = "";
  ui.sev.textContent = "STANDBY";
  ui.sev.className = "sev";
  killCamTimer.forEach(clearTimeout);
  killCamTimer = [];
  playing = true;
}

function connect() {
  const es = new EventSource("/events");
  es.onopen = () => {
    ui.status.textContent = "bus connected";
  };
  es.onmessage = (m) => {
    try {
      if (playing) apply(JSON.parse(m.data), true);
    } catch (e) {}
  };
  es.onerror = () => {
    ui.status.textContent = "reconnecting";
  };
}

function replayServer() {
  resetView();
  fetch("/api/replay", { method: "POST" });
}

function killCam() {
  const hit = [...log].reverse().find((e) => e.type === "VetoIssued");
  if (!hit) {
    ui.status.textContent = "no veto in this run yet";
    return;
  }
  const from = Math.max(0, hit.t_ms - 3000);
  const until = hit.t_ms + 1500;
  const slice = log.filter((e) => e.t_ms >= from && e.t_ms <= until);
  playing = false;
  origin = Date.now() - from;
  ui.fixer.textContent = "";
  ui.red.textContent = "";
  ui.facts.innerHTML = "";
  factsSeen.clear();
  fixerText = "";
  veto = null;
  Object.keys(stamps).forEach((k) => delete stamps[k]);
  ui.status.textContent = "kill-cam " + fmt(from) + " to " + fmt(until);
  killCamTimer.forEach(clearTimeout);
  killCamTimer = [];
  slice.forEach((ev) => {
    const delay = ev.t_ms - from;
    const id = setTimeout(() => apply(ev, false), delay);
    killCamTimer.push(id);
  });
}

$("replay").onclick = replayServer;
$("killcam").onclick = killCam;
$("join").onclick = () => fetch("/api/join", { method: "POST" });
$("leave").onclick = () => fetch("/api/leave", { method: "POST" });
$("send").onclick = sendDirective;
$("cmd").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendDirective();
});
function sendDirective() {
  const text = $("cmd").value.trim();
  if (!text) return;
  fetch("/api/directive", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  $("cmd").value = "";
}
document.addEventListener("keydown", (e) => {
  if (document.activeElement.tagName === "INPUT") return;
  if (e.key === "r" || e.key === "R") replayServer();
  if (e.key === "k" || e.key === "K") killCam();
});

renderAgents();
connect();
