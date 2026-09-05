# PULSE

**The dangerous command dies before it finishes being written.**

PULSE is an incident command room. `checkout-api` is in SEV1 after a deploy. Archaeologist, Hypothesis and Fixer start work on that incident at the same time. RedTeam can veto a dangerous mitigation so the room has to change course. You are Commander: join, send one directive, leave.

Not a chatbot. Not a queue. The product is the overlap and the veto.

Built for **JigJoy × daily.dev × Hyperskill — Build Systems of Concurrent Agents**.

## Contents

1. [Run it (no API key)](#run-it-no-api-key)
2. [The problem](#the-problem)
3. [How it is wired](#how-it-is-wired)
4. [Roster](#roster)
5. [The veto](#the-veto)
6. [Why this is not a chatbot](#why-this-is-not-a-chatbot)
7. [Proof of concurrency](#proof-of-concurrency)
8. [Wall](#wall)
9. [Live (optional)](#live-optional)
10. [Layout](#layout)

---

## Run it (no API key)

```bash
npm install
npm run replay
```

Open http://localhost:8787 and watch.

| Time | What happens |
| --- | --- |
| 0s | Sentry declares `checkout-api`. Triage sets SEV1 |
| ~2s | Archaeologist and Hypothesis emit on the same clock |
| ~4s | Fixer drafts `kubectl delete pod checkout-api --all` |
| same run | RedTeam strikes only that span |
| after | Fixer pivots to restore `PG_POOL_SIZE=50` and bounce a canary |
| any time | Commander Join / Send / Leave. `do not delete` pulls the same veto gate |

**R** restart · **K** Kill-cam (replay the veto window) · `npm test` detector.

Replay is the complete visual demo. Live Mozaik is in `src/mozaik-live.ts` when a supported model key is present.

---

## The problem

Incidents are not pipelines. At 3am one person reads logs, one argues the deploy, one types `kubectl`, one says do not run that in prod.

Most multi-agent demos still go search → analyze → propose → review. The review starts after the command exists.

PULSE keeps investigation, a guess, a fix, and a safety check on one clock.

---

## How it is wired

```
Sentry / Triage declare SEV1
              |
      shared bus + t_ms
        /     |      \
Archaeologist Hyp    Fixer
  evidence   causes  draft     (live: three runLoops, same incident)
                      |
                 findVeto
                /         \
             safe      VetoIssued → FixPivoted → safer draft

Commander is on the same bus
(live: the commander message is what starts the three loops)
```

Archaeologist and Hypothesis **overlap** Fixer. They do not have to finish before the draft starts. The UI only renders bus events. `t_ms` is elapsed time from incident start.

---

## Roster

| Name | Role | Live model loop? |
| --- | --- | --- |
| Sentry | Alarm + raw lines | No — fixture / `IncidentDeclared` |
| Triage | SEV1 + reason | No — `SeveritySet` |
| Archaeologist | Evidence | Yes — `runLoop` |
| Hypothesis | Causes | Yes — `runLoop` |
| Fixer | Draft | Yes — `runLoop` |
| RedTeam | Veto | Same runtime; `findVeto` on Fixer text |
| Facts / Comms | Right rail | Observer |
| Commander | Human bar. Join, send an order, leave. Halt phrases pull the veto gate | `createHuman` — not an LLM |

Six panels are not six paid models.

---

## The veto

This is the interaction the room is built around — not a prize beat.

Fixer drafts `kubectl delete pod checkout-api --all`. The detector in `src/veto.ts` marks **that span**, not the whole paragraph.

```
FixDraftFinal → findVeto() → VetoIssued → FixPivoted → safer draft
```

Safer draft: restore `PG_POOL_SIZE=50`, bounce canary only.

On **replay**, that strike happens while the line is still being written. On **live**, Fixer streaming is off in this repo so the process stays up; `findVeto` runs on the Fixer text that arrives.

Commander can pull the **same gate** without a model. After Fixer has started the dangerous line, Join and send one of: `do not delete`, `hold the kubectl`, `no kubectl`, `stop delete`, `veto`. That emits `VetoIssued` from `commander`. `page payments on-call too` is logged in Facts only — it does not steer Fixer. The halt is pattern match + `src/veto.ts`, not an LLM classifying the order.

---

## Why this is not a chatbot

| Pipeline | PULSE |
| --- | --- |
| Each stage waits | Three loops start on one SEV1 |
| Reviewer sees a finished command | RedTeam can change the outcome |
| Canned status | Facts = landed events only |
| Human is a prompt | Commander joins, logs an order, and can halt a delete |
| Overlap is animation | Swimlane from `t_ms` |

If two ticks are never hot together, concurrency is wrong. If the whole Fixer paragraph goes red, the veto is wrong.

---

## Proof of concurrency

`src/mozaik-live.ts` — grep `runLoop`.

```
infer("archaeologist", ...)
infer("hypothesis", ...)
infer("fixer", ...)
```

No wait between those calls. Each emits `LoopStarted` with `t_ms`. Facts and the swimlane use those events.

---

## Wall

**Header** — service, SEV1, error %, p99, deploy age, clock.

**Ticks** — a name lights when that participant emits.

**Panels** — Sentry, Triage, Archaeologist, Hypothesis, Fixer, RedTeam.

**Facts** — far right. Landed events only.

**Overlap** — bars from timestamps. Stacked = concurrent.

**Commander** — bottom. Join / Send / Leave. Halt phrases (`do not delete`, …) emit `VetoIssued` from commander. Other lines land in Facts only. Status on the right is the last bus event.

---

## Live (optional)

Replay needs no model. Live (`npm run live`) uses `@mozaik-ai/core` and **whichever allowlisted provider you have credit for**. Gemini is one option, not the only one. Mozaik picks the vendor from the model name.

| Provider | Env var | Example `PULSE_MODEL_FAST` |
| --- | --- | --- |
| Google | `GEMINI_API_KEY` | `gemini-3.5-flash` or `gemini-3.1-pro-preview` |
| OpenAI | `OPENAI_API_KEY` | `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.5` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-7`, `claude-opus-4-8` |
| DeepSeek | `OPENAI_API_KEY` + compatible base URL if required | `deepseek-v4-flash`, `deepseek-v4-pro` |

```powershell
$env:GEMINI_API_KEY="your-key"              # or OPENAI_API_KEY / ANTHROPIC_API_KEY
$env:PULSE_MODEL_FAST="gemini-3.5-flash"    # or gpt-5.5 / claude-haiku-4-5 / ...
npm run live
```

`.env` next to `package.json`, never committed. Same variable names as the table.

Names **not** on that list (Groq, Llama, `gpt-4.1-mini`) fail before HTTP. Ignore `MOZAIK_API_KEY` (telemetry). Node 22+.

Live Fixer uses `streaming: false` in this build. Gemini streaming hits a missing Mozaik transition after `inference_streaming`. Replay still shows the mid-line strike. OpenAI streaming may work if you have credit; do not claim it until you see chunks on the wall.

---

## Layout

`src/mozaik-live.ts` · `src/replay.ts` · `src/veto.ts` · `src/load-env.ts` · `ui/`
