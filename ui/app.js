const ROLES = {
  sentry: "declare",
  triage: "roster",
  archaeologist: "search",
  hypothesis: "theories",
  fixer: "draft",
  redteam: "veto",
  comms: "status",
  commander: "human",
  wall: "observe",
};

const els = {
  clock: document.getElementById("clock"),
  sev: document.getElementById("sev"),
  service: document.getElementById("service"),
  symptom: document.getElementById("symptom"),
  p99: document.getElementById("m-p99"),
  err: document.getElementById("m-err"),
  deploy: document.getElementById("m-deploy"),
  roster: document.getElementById("roster"),
  fixer: document.getElementById("fixer"),
  fixerState: document.getElementById("fixer-state"),
  red: document.getElementById("redteam"),
  redState: document.getElementById("red-state"),
  evidence: document.getElementById("evidence"),
  hypos: document.getElementById("hypos"),
  comms: document.getElementById("comms"),
  status: document.getElementById("status"),
  gantt: document.getElementById("gantt"),
  overlap: document.getElementById("overlap"),
  flash: document.getElementById("flash"),
};

const lastSeen = {};
const lastAction = {};
const roster = new Set(["sentry", "triage", "wall"]);
const activity = {};
const buckets = {};
let origin = 0;
let lastVeto = null;

function fmt(ms) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
}

setInterval(() => {
  if (!origin) return;
  els.clock.textContent = fmt(Date.now() - origin);
  document.querySelectorAll(".agent").forEach((n) => {
    const hot = Date.now() - (lastSeen[n.dataset.id] || 0) < 400;
    n.classList.toggle("hot", hot);
  });
  proveOverlap();
}, 80);

function proveOverlap() {
  const now = Date.now();
  const live = Object.entries(lastSeen).filter(([, t]) => now - t < 400).map(([id]) => id);
  if (live.length >= 2) {
    els.overlap.textContent = `overlap ${live.join(" + ")}`;
    els.overlap.classList.add("live");
  }
}

function renderRoster() {
  els.roster.innerHTML = [...roster]
    .map((id) => {
      const veto = id === "redteam" && lastVeto ? "veto" : "";
      return `<div class="agent ${veto}" data-id="${id}">
        <span class="dot"></span>
        <div><b>${id}</b><small>${lastAction[id] || "quiet"}</small></div>
        <span class="role">${ROLES[id] || ""}</span>
      </div>`;
    })
    .join("");
}

function mark(id, t, action) {
  lastSeen[id] = Date.now();
  if (action) lastAction[id] = action;
  if (!activity[id]) activity[id] = [];
  activity[id].push(t);
  const bucket = Math.floor((t || 0) / 250);
  buckets[bucket] = buckets[bucket] || new Set();
  buckets[bucket].add(id);
  renderGantt();
  renderRoster();
}

function renderGantt() {
  const max = Math.max(1000, ...Object.values(activity).flat(), 1);
  els.gantt.innerHTML = Object.entries(activity)
    .map(([id, times]) => {
      const bars = times
        .map((t) => `<i class="${id === "redteam" ? "red" : ""}" style="left:${(t / max) * 100}%"></i>`)
        .join("");
      return `<div class="lane"><div class="name">${id}</div><div class="bar">${bars}</div></div>`;
    })
    .join("");
}

function flash(text) {
  els.flash.textContent = text;
  els.flash.classList.add("show");
  setTimeout(() => els.flash.classList.remove("show"), 4200);
}

function handle(ev) {
  if (!origin) origin = Date.now() - (ev.t_ms || 0);
  const from = ev.from;
  if (from && from !== "system" && from !== "fixture") {
    roster.add(from);
    mark(from, ev.t_ms || 0, ev.type);
  }
  els.status.textContent = `${fmt(ev.t_ms || 0)}  ${ev.type} ← ${from}`;

  if (ev.type === "IncidentDeclared") {
    els.service.textContent = ev.payload.service;
    els.symptom.textContent = ev.payload.symptom;
    els.p99.textContent = `${ev.payload.p99ms}ms`;
    els.err.textContent = `${ev.payload.errorRate}%`;
    els.deploy.textContent = `${ev.payload.deployAgeMin}m`;
  }
  if (ev.type === "SeveritySet") {
    els.sev.textContent = ev.payload.sev;
    els.sev.className = `sev ${ev.payload.sev}`;
  }
  if (ev.type === "RosterChanged") {
    for (const id of ev.payload.joined || []) roster.add(id);
    for (const id of ev.payload.left || []) roster.delete(id);
    renderRoster();
  }
  if (ev.type === "EvidenceFound") {
    els.evidence.insertAdjacentHTML(
      "afterbegin",
      `<div class="card"><b>${ev.payload.kind}</b> ${ev.payload.quote}<div class="meta">${ev.payload.path} · ${Math.round(ev.payload.confidence * 100)}%</div></div>`,
    );
  }
  if (ev.type === "HypothesisPosted" || ev.type === "HypothesisUpdated") {
    const p = ev.payload;
    els.hypos.insertAdjacentHTML(
      "afterbegin",
      `<div class="card"><b>${p.hid}</b> ${p.title || p.note || p.claim || ""}
        <div class="conf"><i style="width:${Math.round((p.confidence || 0) * 100)}%"></i></div></div>`,
    );
  }
  if (ev.type === "FixDraftDelta") {
    if (ev.payload.draftId === "draft-2") els.fixer.classList.remove("vetoed");
    els.fixer.textContent = ev.payload.fullSoFar;
    els.fixerState.textContent = "streaming";
    els.fixerState.classList.add("live");
  }
  if (ev.type === "VetoIssued") {
    lastVeto = ev;
    els.fixer.classList.add("vetoed");
    els.redState.textContent = "veto";
    els.redState.classList.add("kill");
    els.red.textContent = `VETO  char ${ev.payload.atChar}\n${ev.payload.reason}\n${ev.payload.dangerousSpan}`;
    flash(`VETO · ${ev.payload.dangerousSpan} · char ${ev.payload.atChar}`);
  }
  if (ev.type === "FixPivoted") {
    els.red.textContent += `\n\nPIVOT → ${ev.payload.to}`;
    els.fixerState.textContent = "pivot";
  }
  if (ev.type === "StatusDrafted") {
    els.comms.insertAdjacentHTML("afterbegin", `<div class="card"><b>${ev.payload.channel}</b> ${ev.payload.text}</div>`);
  }
  if (ev.type === "IncidentMitigated") {
    els.status.textContent = `MITIGATED · ${ev.payload.summary}`;
    els.sev.textContent = "MITIGATED";
  }
}

function connect() {
  const es = new EventSource("/events");
  es.onopen = () => { els.status.textContent = "bus connected"; };
  es.onmessage = (m) => {
    try { handle(JSON.parse(m.data)); } catch {}
  };
  es.onerror = () => { els.status.textContent = "reconnecting…"; };
}

function resetView() {
  origin = 0;
  lastVeto = null;
  els.fixer.textContent = "";
  els.red.textContent = "";
  els.evidence.innerHTML = "";
  els.hypos.innerHTML = "";
  els.comms.innerHTML = "";
  els.fixer.classList.remove("vetoed");
  els.fixerState.textContent = "idle";
  els.redState.textContent = "listening";
  els.redState.classList.remove("kill");
  Object.keys(activity).forEach((k) => delete activity[k]);
}

document.getElementById("replay").onclick = () => {
  resetView();
  fetch("/api/replay", { method: "POST" });
};
document.getElementById("killcam").onclick = () => {
  if (!lastVeto) {
    els.status.textContent = "no veto yet";
    return;
  }
  els.fixer.scrollIntoView({ behavior: "smooth", block: "center" });
  flash(`KILL-CAM · veto at t=${fmt(lastVeto.t_ms)} char ${lastVeto.payload.atChar}`);
};
document.getElementById("join").onclick = () => {
  els.status.textContent = "Join is simulated in replay. Live mode will call participant.join().";
};
document.getElementById("leave").onclick = () => {
  els.status.textContent = "Leave is simulated in replay.";
};

renderRoster();
connect();
