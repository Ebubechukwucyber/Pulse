/**
 * Weekend substance — Mozaik v4.
 * Two agents on one runtime. Fixer runLoop streams. RedTeam
 * listens to inference.stream and steers the loop to idle on veto.
 *
 * Requires: npm install @mozaik-ai/core
 *           a provider key in .env
 *
 * Replay stays as the no-key backup.
 */

import {
  defineRuntime,
  RuntimeState,
  createAgent,
  createHuman,
  SituationSpecification,
} from "@mozaik-ai/core";
import { bus } from "./bus.ts";
import { clock, uid } from "./clock.ts";
import { loadIncident } from "./fixture.ts";
import { findVeto } from "./veto.ts";

class PulseState extends RuntimeState {
  draft = "";
  vetoed = false;
}

const runtime = defineRuntime();
const { initializeRuntime, join, sendMessage, runLoop } = runtime;

class WhenStreamChunk extends SituationSpecification {
  isSatisfiedBy({ event }) {
    return event.type === "inference.stream";
  }
}

class WhenMessage extends SituationSpecification {
  isSatisfiedBy({ event, participant }) {
    return event.type === "message.sent" && event.producerId !== participant.getId();
  }
}

function emitDelta(full, delta, draftId) {
  bus.emit({
    id: uid(),
    t_ms: clock.now(),
    type: "FixDraftDelta",
    from: "fixer",
    payload: { draftId, delta, fullSoFar: full },
  });
}

function emitVeto(hit, draftId) {
  bus.emit({
    id: uid(),
    t_ms: clock.now(),
    type: "VetoIssued",
    from: "redteam",
    to: "fixer",
    payload: {
      draftId,
      atChar: hit.atChar,
      reason: hit.reason,
      dangerousSpan: hit.dangerousSpan,
    },
  });
}

export function liveStatus() {
  return "Mozaik v4 live: Fixer runLoop + RedTeam inference.stream intercept.";
}

export async function startMozaikRoom() {
  const incident = loadIncident("checkout-sevi");
  clock.reset();
  bus.reset();

  const state = new PulseState();
  initializeRuntime({ state });

  const model = process.env.PULSE_MODEL_FAST || "gpt-4.1-mini";

  const redTeam = createAgent({
    name: "redteam",
    capabilities: ["inference"],
    instruction: "You intercept dangerous live mitigations. You do not write the fix.",
    tools: [],
    handlers: [
      {
        specification: new WhenStreamChunk(),
        processor: {
          apply({ event }) {
            const delta = String(
              event.payload?.delta ?? event.payload?.data?.delta ?? "",
            );
            if (!delta) return;
            state.draft += delta;
            emitDelta(state.draft, delta, state.vetoed ? "draft-2" : "draft-1");
            if (state.vetoed) return;
            const hit = findVeto(state.draft, incident.forbiddenSpans);
            if (!hit) return;
            state.vetoed = true;
            emitVeto(hit, "draft-1");
          },
        },
      },
    ],
  });

  const fixer = createAgent({
    name: "fixer",
    capabilities: ["inference"],
    instruction:
      "You propose a checkout-api mitigation. Prefer restoring PG_POOL_SIZE=50. Never delete a whole cluster. If you mention kubectl, RedTeam will stop you.",
    tools: [],
    handlers: [
      {
        specification: new WhenMessage(),
        processor: {
          apply({ event, participant }) {
            const { message } = event.payload;
            runLoop(
              participant.getId(),
              String(message),
              { model, streaming: true, context: participant.getMemory().getContext() },
              {
                isSatisfiedBy(transition) {
                  return state.vetoed && transition.nextStateId !== "idle";
                },
                async handle(transition) {
                  return { ...transition, nextStateId: "idle" };
                },
              },
            );
          },
        },
      },
    ],
  });

  const commander = createHuman({ name: "commander", capabilities: [], handlers: [] });

  join(redTeam);
  join(fixer);
  join(commander);

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
    payload: { joined: ["fixer", "redteam", "commander"], left: [], reason: "mozaik join" },
  });

  sendMessage(
    `SEV1 ${incident.service}: ${incident.symptom}. Deploy ${incident.tag}. Propose mitigation now.`,
    commander.getId(),
  );
}
