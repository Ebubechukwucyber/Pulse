const clockEl = document.getElementById("clock");
const incidentEl = document.getElementById("incident");
const sevEl = document.getElementById("sev");
const pillsEl = document.getElementById("pills");
const rosterEl = document.getElementById("roster");
const fixerEl = document.getElementById("fixer");
const redEl = document.getElementById("redteam");
const sideEl = document.getElementById("side");
const statusEl = document.getElementById("status");
const ganttEl = document.getElementById("gantt");

const lastSeen = {};
const roster = new Set(["sentry", "triage", "wall"]);
const activity = {};
let origin = 0;
let vetoed = false;

function fmt(ms) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, "0")}:${r.toFixed(1).padStart(4, "0")}`;
}

setInterval(() => {
  if (!origin) return;
  clockEl.textContent = fmt(Date.now() - origin);
  pillsEl.querySelectorAll(".pill").forEach((p) => {
    const id = p.dataset.id;
    p.classList.toggle("hot", Date.now() - (lastSeen[id] || 0) < 400);
  });
}, 80);

function renderPills() {
  pillsEl.innerHTML = [...roster]
    .map((id) => `<span class="pill" data-id="${id}">${id}</span>`)
    .join("");
  rosterEl.innerHTML = [...roster]
    .map((id) => `<div class="card"><b>${id}</b></div>`)
    .join("");
}

function mark(id, t) {
  lastSeen[id] = Date.now();
  if (!activity[id]) activity[id] = [];
  activity[id].push(t);
  renderGantt();
}

function renderGantt() {
  const max = Math.max(1000, ...Object.values(activity).flat(), 1);
  ganttEl.innerHTML = Object.entries(activity)
    .map(([id, times]) => {
      const bars = times
        .map((t) => {
          const left = (t / max) * 100;
          const cls = id === "redteam" ? "red" : "";
          return `<i class="${cls}" style="left:${left}%;width:3%"></i>`;
        })
        .join("");
      return `<div class="lane"><div class="name">${id}</div><div class="bar">${bars}</div></div>`;
    })
    .join("");
}

function handle(ev) {
  if (!origin) origin = Date.now() - (ev.t_ms || 0);
  const from = ev.from;
  if (from && from !== "system" && from !== "fixture") {
    roster.add(from);
    mark(from, ev.t_ms || 0);
  }
  statusEl.textContent = `${ev.type} ← ${from}`;

  if (ev.type === "IncidentDeclared") {
    incidentEl.textContent = `${ev.payload.service} · ${ev.payload.symptom}`;
  }
  if (ev.type === "SeveritySet") {
    sevEl.textContent = ev.payload.sev;
  }
  if (ev.type === "RosterChanged") {
    for (const id of ev.payload.joined || []) roster.add(id);
    for (const id of ev.payload.left || []) roster.delete(id);
  }
  if (ev.type === "EvidenceFound") {
    sideEl.insertAdjacentHTML(
      "afterbegin",
      `<div class="card"><b>evidence</b> ${ev.payload.path}<br>${ev.payload.quote}</div>`,
    );
  }
  if (ev.type === "HypothesisPosted" || ev.type === "HypothesisUpdated") {
    sideEl.insertAdjacentHTML(
      "afterbegin",
      `<div class="card"><b>${ev.payload.hid}</b> ${ev.payload.title || ev.payload.note || ""} · ${Math.round((ev.payload.confidence || 0) * 100)}%</div>`,
    );
  }
  if (ev.type === "FixDraftDelta") {
    if (ev.payload.draftId === "draft-2") fixerEl.classList.remove("vetoed");
    fixerEl.textContent = ev.payload.fullSoFar;
  }
  if (ev.type === "VetoIssued") {
    vetoed = true;
    fixerEl.classList.add("vetoed");
    redEl.textContent = `VETO at char ${ev.payload.atChar}\n${ev.payload.reason}\nspan: ${ev.payload.dangerousSpan}`;
  }
  if (ev.type === "FixPivoted") {
    redEl.textContent += `\n\npivot → ${ev.payload.to}`;
  }
  if (ev.type === "StatusDrafted") {
    sideEl.insertAdjacentHTML(
      "afterbegin",
      `<div class="card"><b>comms</b> ${ev.payload.text}</div>`,
    );
  }
  if (ev.type === "IncidentMitigated") {
    statusEl.textContent = `MITIGATED · ${ev.payload.summary}`;
  }
  renderPills();
}

function connect() {
  const es = new EventSource("/events");
  es.onopen = () => {
    statusEl.textContent = "bus connected";
  };
  es.onmessage = (m) => {
    try {
      handle(JSON.parse(m.data));
    } catch {
      /* ignore */
    }
  };
  es.onerror = () => {
    statusEl.textContent = "reconnecting…";
  };
}

document.getElementById("replay").onclick = () => {
  origin = 0;
  vetoed = false;
  fixerEl.textContent = "";
  redEl.textContent = "";
  sideEl.innerHTML = "";
  Object.keys(activity).forEach((k) => delete activity[k]);
  fetch("/api/replay", { method: "POST" });
};

document.getElementById("join").onclick = () => {
  statusEl.textContent = "Join is simulated in replay. Live mode will call participant.join().";
};
document.getElementById("leave").onclick = () => {
  statusEl.textContent = "Leave is simulated in replay.";
};

renderPills();
connect();
