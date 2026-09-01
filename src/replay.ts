import { bus } from "./bus.ts";
import { clock, uid } from "./clock.ts";
import type { BusEvent, BusEventType, ParticipantId } from "./events.ts";
import { loadIncident } from "./fixture.ts";
import { findVeto } from "./veto.ts";

function ev(
  t_ms: number,
  type: BusEventType,
  from: ParticipantId | "fixture" | "system",
  payload: unknown,
): BusEvent {
  return { id: uid(), t_ms, type, from, to: "broadcast", payload };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const DANGEROUS = "kubectl delete pod checkout-api --all";
const SAFE = "Restore PG_POOL_SIZE=50 and bounce checkout-api canary only. Add pool saturation alert.";

export async function playCheckoutDemo(signal?: { stopped: boolean }) {
  const incident = loadIncident("checkout-sevi");
  clock.reset();
  bus.reset();

  const start = Date.now();
  const t = () => Date.now() - start;

  const push = async (wait: number, event: Omit<BusEvent, "id">) => {
    if (signal?.stopped) return;
    await sleep(wait);
    bus.emit({ ...event, id: uid() });
  };

  await push(400, ev(t(), "IncidentDeclared", "sentry", {
    id: incident.id,
    service: incident.service,
    symptom: incident.symptom,
    errorRate: incident.errorRate,
    p99ms: incident.p99ms,
    deployAgeMin: incident.deployAgeMin,
    rawLines: incident.rawLines,
  }));

  await push(600, ev(t(), "SeveritySet", "triage", {
    sev: "SEV1",
    reason: "checkout error rate 18% within 14m of deploy",
  }));

  await push(400, ev(t(), "RosterChanged", "triage", {
    joined: ["archaeologist", "hypothesis", "fixer", "redteam", "comms"],
    left: [],
    reason: "SEV1 specialist spawn",
  }));

  const evidenceWait = Promise.all([
    (async () => {
      await sleep(200);
      bus.emit(ev(t(), "EvidenceFound", "archaeologist", {
        kind: "log",
        quote: incident.rawLines[3],
        path: "logs/checkout-api",
        confidence: 0.86,
      }));
      await sleep(500);
      bus.emit(ev(t(), "EvidenceFound", "archaeologist", {
        kind: "code",
        quote: incident.repoSnippets[1].quote,
        path: incident.repoSnippets[1].path,
        confidence: 0.9,
      }));
    })(),
    (async () => {
      await sleep(180);
      bus.emit(ev(t(), "HypothesisPosted", "hypothesis", {
        hid: "H-A",
        title: "Bad index after deploy",
        claim: "A missing index on orders is causing checkout timeouts.",
        confidence: 0.41,
      }));
      await sleep(420);
      bus.emit(ev(t(), "HypothesisPosted", "hypothesis", {
        hid: "H-B",
        title: "Pool shrink in v1.18.4",
        claim: "PG_POOL_SIZE dropped 50 → 8 in the deploy. Saturation matches waiter logs.",
        confidence: 0.78,
      }));
    })(),
  ]);
  await evidenceWait;

  await push(200, ev(t(), "HypothesisUpdated", "hypothesis", {
    hid: "H-A",
    confidence: 0.22,
    note: "no index evidence in snippet pack",
  }));

  const draftId = "draft-1";
  let full = "";
  for (const chunk of chunkText("Mitigation: " + DANGEROUS, 4)) {
    full += chunk;
    bus.emit(ev(t(), "FixDraftDelta", "fixer", { draftId, delta: chunk, fullSoFar: full }));
    await sleep(70);
  }

  const hit = findVeto(full, incident.forbiddenSpans);
  if (hit) {
    await push(120, ev(t(), "VetoIssued", "redteam", {
      draftId,
      atChar: hit.atChar,
      reason: hit.reason,
      dangerousSpan: hit.dangerousSpan,
    }));
  }

  await push(350, ev(t(), "FixPivoted", "fixer", {
    draftId,
    from: DANGEROUS,
    to: SAFE,
    reason: "redteam veto",
  }));

  let safe = "";
  for (const chunk of chunkText(SAFE, 5)) {
    safe += chunk;
    bus.emit(ev(t(), "FixDraftDelta", "fixer", {
      draftId: "draft-2",
      delta: chunk,
      fullSoFar: safe,
    }));
    await sleep(55);
  }
  bus.emit(ev(t(), "FixDraftFinal", "fixer", {
    draftId: "draft-2",
    text: safe,
    kind: "runbook",
  }));

  await push(300, ev(t(), "StatusDrafted", "comms", {
    channel: "slack",
    text: "SEV1 checkout-api: pool size 50→8 in v1.18.4. Cluster-wide delete vetoed. Restoring pool=50 and bouncing canary only.",
    factsUsed: ["pool_size changed 50 -> 8", "veto kubectl delete", "canary bounce"],
  }));

  await push(500, ev(t(), "RosterChanged", "triage", {
    joined: ["commander"],
    left: [],
    reason: "human commander joined",
  }));

  await push(400, ev(t(), "HumanDirective", "commander", {
    text: "page payments on-call too",
  }));

  await push(350, ev(t(), "StatusDrafted", "comms", {
    channel: "slack",
    text: "Also paging payments on-call per commander.",
    factsUsed: ["HumanDirective: page payments on-call too"],
  }));

  await push(400, ev(t(), "RosterChanged", "triage", {
    joined: [],
    left: ["commander"],
    reason: "human commander left",
  }));

  await push(200, ev(t(), "ParticipantLeftWork", "triage", {
    who: "commander",
    openTasks: ["approve-canary-bounce"],
    reassignedTo: "fixer",
  }));

  await push(500, ev(t(), "IncidentMitigated", "triage", {
    summary: "Pool restored. Dangerous cluster delete never finished.",
    survivingFix: SAFE,
  }));
}

function chunkText(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}
