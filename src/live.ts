/**
 * Live room — Mozaik-shaped, no model key required yet.
 *
 * Official example this copies:
 * jigjoy-ai/mozaik-examples / inference-interception
 * Planner streams + SafetyReviewer aborts via AbortSignal.
 *
 * When @mozaik-ai/core is installed:
 *   swap Fixer.stream() for runInference({ streaming: true, signal })
 *   swap RedTeam.watch() for BaseAgent.onExternalEvent
 * Do not delete replay.
 */

import { bus } from "./bus.ts";
import { clock, uid } from "./clock.ts";
import { loadIncident } from "./fixture.ts";
import { Fixer } from "./participants/fixer.ts";
import { RedTeam } from "./participants/redteam.ts";

const DANGEROUS = "kubectl delete pod checkout-api --all";
const SAFE = "Restore PG_POOL_SIZE=50 and bounce checkout-api canary only. Add pool saturation alert.";

export function liveStatus(): string {
  return "LIVE ROOM: local stream + AbortController intercept. @mozaik-ai/core not required for this slice. Replay still works.";
}

export async function startLiveRoom() {
  const incident = loadIncident("checkout-sevi");
  clock.reset();
  bus.reset();

  const fixer = new Fixer();
  const red = new RedTeam(() => fixer.abort.abort(), incident.forbiddenSpans);
  red.watch();

  bus.emit({
    id: uid(),
    t_ms: clock.now(),
    type: "IncidentDeclared",
    from: "sentry",
    payload: {
      id: incident.id,
      service: incident.service,
      symptom: incident.symptom,
      errorRate: incident.errorRate,
      p99ms: incident.p99ms,
      deployAgeMin: incident.deployAgeMin,
      rawLines: incident.rawLines,
    },
  });

  bus.emit({
    id: uid(),
    t_ms: clock.now(),
    type: "SeveritySet",
    from: "triage",
    payload: { sev: "SEV1", reason: "checkout error rate 18% within 14m of deploy" },
  });

  bus.emit({
    id: uid(),
    t_ms: clock.now(),
    type: "RosterChanged",
    from: "triage",
    payload: {
      joined: ["fixer", "redteam", "comms"],
      left: [],
      reason: "live intercept slice",
    },
  });

  await fixer.stream("draft-1", "Mitigation: " + DANGEROUS);

  bus.emit({
    id: uid(),
    t_ms: clock.now(),
    type: "FixPivoted",
    from: "fixer",
    payload: { from: "draft-1", to: "draft-2", reason: "veto" },
  });

  fixer.resetAbort();
  await fixer.stream("draft-2", SAFE, 4, 30);

  bus.emit({
    id: uid(),
    t_ms: clock.now(),
    type: "IncidentMitigated",
    from: "triage",
    payload: {
      summary: "Pool restored. Dangerous cluster delete never finished.",
      survivingFix: SAFE,
    },
  });
}
