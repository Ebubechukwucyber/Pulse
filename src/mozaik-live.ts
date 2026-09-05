/**
 * Four Mozaik agents, one runtime.
 * Archaeologist / Hypothesis / Fixer runLoop on the same SEV1
 * without waiting. Identity is the id stored at join — not producerName.
 * Fixer requests streaming so veto can run on a partial draft.
 * Arch/Hyp stay non-streaming. Server must not die if Mozaik
 * throws after inference_streaming.
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
  pivoted = false;
}

const runtime = defineRuntime();
const { initializeRuntime, join, sendMessage, runLoop } = runtime;

class WhenOthersSpeak extends SituationSpecification {
  isSatisfiedBy({ event, participant }) {
    return event.type === "message.sent" && event.producerId !== participant.getId();
  }
}

class WhenAnyoneSpeaks extends SituationSpecification {
  isSatisfiedBy({ event }) {
    return event.type === "message.sent" || event.type === "model.answer";
  }
}

class WhenStream extends SituationSpecification {
  isSatisfiedBy({ event }) {
    return event.type === "inference.stream";
  }
}

function textOf(event) {
  const p = event.payload || {};
  const nested = p.answer && p.answer.content && p.answer.content.text;
  const content = typeof p.content === "string" ? p.content : p.content && p.content.text;
  return String(p.message ?? p.text ?? nested ?? content ?? p.delta ?? "");
}

function emit(type, from, payload) {
  bus.emit({
    id: uid(),
    t_ms: clock.now(),
    type,
    from,
    to: "broadcast",
    payload,
  });
}

export function liveStatus() {
  return "Mozaik v4: three runLoops start on one SEV1; RedTeam veto can force a fixer pivot.";
}

export async function startMozaikRoom() {
  const incident = loadIncident("checkout-sevi");
  clock.reset();
  bus.reset();

  const state = new PulseState();
  initializeRuntime({ state });

  const model = process.env.PULSE_MODEL_FAST || "gemini-3.5-flash";
  const byId = {};

  const afterStream = {
    isSatisfiedBy(transition) {
      const next = transition && transition.nextStateId;
      const from =
        (transition && (transition.stateId || transition.currentStateId)) || "";
      return from === "inference_streaming" || next == null || next === "";
    },
    async handle(transition) {
      if (transition && transition.nextStateId) return transition;
      return { ...transition, nextStateId: "model_message" };
    },
  };

  const infer = (role, participant, message, streaming) => {
    emit("LoopStarted", role, { role, model, t_ms: clock.now(), streaming: !!streaming });
    try {
      const pending = runLoop(
        participant.getId(),
        String(message),
        {
          model,
          streaming: !!streaming,
          context: participant.getMemory().getContext(),
        },
        streaming ? afterStream : undefined,
      );
      if (pending && typeof pending.catch === "function") {
        pending.catch((err) => {
          console.log("runLoop ended:", role, String(err?.message ?? err));
        });
      }
    } catch (err) {
      console.log("runLoop threw:", role, String(err?.message ?? err));
    }
  };

  const scene =
    `SEV1 ${incident.service}. ${incident.symptom}. ` +
    `Deploy ${incident.tag}, age ${incident.deployAgeMin}m. ` +
    `Logs:\n${incident.rawLines.join("\n")}\n` +
    `Repo:\n${incident.repoSnippets.map((s) => s.path + ": " + s.quote).join("\n")}`;

  const archaeologist = createAgent({
    name: "archaeologist",
    capabilities: ["inference"],
    instruction: "Extract evidence only. Quote log and repo lines. No kubectl. Max 4 bullets.",
    tools: [],
    handlers: [
      {
        specification: new WhenOthersSpeak(),
        processor: {
          apply({ event, participant }) {
            if (!textOf(event).includes("SEV1")) return;
            infer("archaeologist", participant, "Evidence only.\n" + scene, false);
          },
        },
      },
    ],
  });

  const hypothesis = createAgent({
    name: "hypothesis",
    capabilities: ["inference"],
    instruction: "Competing hypotheses only. Strongest first. No kubectl. 3 lines.",
    tools: [],
    handlers: [
      {
        specification: new WhenOthersSpeak(),
        processor: {
          apply({ event, participant }) {
            if (!textOf(event).includes("SEV1")) return;
            infer("hypothesis", participant, "Hypotheses only.\n" + scene, false);
          },
        },
      },
    ],
  });

  const fixer = createAgent({
    name: "fixer",
    capabilities: ["inference"],
    instruction:
      "One checkout-api mitigation. Prefer PG_POOL_SIZE=50 and canary bounce. One paragraph.",
    tools: [],
    handlers: [
      {
        specification: new WhenOthersSpeak(),
        processor: {
          apply({ event, participant }) {
            const t = textOf(event);
            if (t.includes("SEV1") && !state.vetoed) {
              infer("fixer", participant, "Propose mitigation now.\n" + scene, false);
              return;
            }
            if (t.startsWith("VETO") && state.vetoed && !state.pivoted) {
              state.pivoted = true;
              emit("FixPivoted", "fixer", { from: "draft-1", to: "draft-2", reason: "veto" });
              infer(
                "fixer",
                participant,
                "VETO applied. Write a safe mitigation only: restore PG_POOL_SIZE=50 and bounce checkout-api canary. Do not delete pods cluster-wide.\n" +
                  scene,
                false,
              );
            }
          },
        },
      },
    ],
  });

  const redTeam = createAgent({
    name: "redteam",
    capabilities: ["inference"],
    instruction: "Judge mitigations only. VETO or ALLOW.",
    tools: [],
    handlers: [],
  });

  const wall = createAgent({
    name: "wall",
    capabilities: [],
    instruction: "Forward only. Never infer.",
    tools: [],
    handlers: [
      {
        specification: new WhenStream(),
        processor: {
          apply({ event }) {
            const delta = String(
              event.payload?.delta ?? event.payload?.data?.delta ?? event.payload?.text ?? "",
            );
            if (!delta) return;
            state.draft += delta;
            const draftId = state.pivoted ? "draft-2" : "draft-1";
            emit("FixDraftDelta", "fixer", {
              draftId,
              delta,
              fullSoFar: state.draft,
            });
            if (state.vetoed) return;
            const hit = findVeto(state.draft, incident.forbiddenSpans);
            if (!hit) return;
            state.vetoed = true;
            emit("VetoIssued", "redteam", {
              draftId: "draft-1",
              atChar: hit.atChar,
              reason: hit.reason,
              dangerousSpan: hit.dangerousSpan,
            });
            sendMessage("VETO: " + hit.reason + " — rewrite safe mitigation.", redTeam.getId());
          },
        },
      },
      {
        specification: new WhenAnyoneSpeaks(),
        processor: {
          apply({ event }) {
            const t = textOf(event);
            if (!t) return;
            const role = byId[event.producerId];
            if (role === "archaeologist") {
              emit("EvidenceFound", "archaeologist", {
                kind: "live",
                quote: t.slice(0, 400),
                path: "live/archaeologist",
                confidence: 0.7,
              });
            }
            if (role === "hypothesis") {
              emit("HypothesisPosted", "hypothesis", {
                hid: "h-live",
                title: "live",
                claim: t.slice(0, 400),
                confidence: 0.6,
              });
            }
            if (role === "fixer") {
              const draftId = state.pivoted ? "draft-2" : "draft-1";
              state.draft = t;
              emit("FixDraftDelta", "fixer", { draftId, delta: t, fullSoFar: t });
              emit("FixDraftFinal", "fixer", { draftId, text: t, kind: "live" });
              if (!state.vetoed) {
                const hit = findVeto(t, incident.forbiddenSpans);
                if (hit) {
                  state.vetoed = true;
                  emit("VetoIssued", "redteam", {
                    draftId: "draft-1",
                    atChar: hit.atChar,
                    reason: hit.reason,
                    dangerousSpan: hit.dangerousSpan,
                  });
                  sendMessage("VETO: " + hit.reason + " — rewrite safe mitigation.", redTeam.getId());
                }
              }
            }
          },
        },
      },
    ],
  });

  const commander = createHuman({ name: "commander", capabilities: [], handlers: [] });

  join(wall);
  join(archaeologist);
  join(hypothesis);
  join(fixer);
  join(redTeam);
  join(commander);

  byId[archaeologist.getId()] = "archaeologist";
  byId[hypothesis.getId()] = "hypothesis";
  byId[fixer.getId()] = "fixer";
  byId[redTeam.getId()] = "redteam";
  byId[commander.getId()] = "commander";

  emit("IncidentDeclared", "sentry", {
    id: incident.id,
    service: incident.service,
    symptom: incident.symptom,
    errorRate: incident.errorRate,
    p99ms: incident.p99ms,
    deployAgeMin: incident.deployAgeMin,
    rawLines: incident.rawLines,
  });
  emit("SeveritySet", "triage", {
    sev: "SEV1",
    reason: "checkout error rate 18% within 14m of deploy",
  });
  emit("RosterChanged", "triage", {
    joined: ["archaeologist", "hypothesis", "fixer", "redteam", "commander"],
    left: [],
    reason: "four-agent mozaik join",
  });
  emit("EvidenceFound", "archaeologist", {
    kind: "log",
    quote: incident.rawLines[3] || incident.rawLines[0],
    path: "logs/checkout-api",
    confidence: 0.8,
  });
  emit("HypothesisPosted", "hypothesis", {
    hid: "H-live",
    title: "pool shrink after deploy",
    claim: "PG_POOL_SIZE drop after " + incident.tag + " is starving checkout checkouts.",
    confidence: 0.7,
  });

  sendMessage(scene, commander.getId());
}
