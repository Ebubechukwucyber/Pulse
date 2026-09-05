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
| any time | Commander Join / Send / Leave |

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
| Commander | Human bar | `createHuman` |

Six panels are not six paid models.

---

## The veto

This is the interaction the room is built around — not a prize beat.

Fixer drafts `kubectl delete pod checkout-api --all`. The detector in `src/veto.ts` marks **that span**, not the whole paragraph.

```
FixDraftFinal → findVeto() → VetoIssued → FixPivoted → safer draft
```

Safer draft: restore `PG_POOL_SIZE=50`, bounce canary only.

On **replay**, that strike happens while the line is still being written. On **live**, streaming is off (this Mozaik + Gemini build dies on `inference_streaming`), so `findVeto` runs on the Fixer text that actually arrives.

---

## Why this is not a chatbot

| Pipeline | PULSE |
| --- | --- |
| Each stage waits | Three loops start on one SEV1 |
| Reviewer sees a finished command | RedTeam can change the outcome |
| Canned status | Facts = landed events only |
| Human is a prompt | Commander joins and leaves |
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

**Commander** — bottom. Status on the right is the last bus event.

---

## Live (optional)

```powershell
$env:GEMINI_API_KEY="your-key"
$env:PULSE_MODEL_FAST="gemini-3.5-flash"
npm run live
```

`.env` next to `package.json`, never committed. Allowlisted names only: `gemini-3.5-flash`, `gemini-3.1-pro-preview`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.5`, `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-7`, `claude-opus-4-8`, `deepseek-v4-flash`, `deepseek-v4-pro`.

Groq / Llama / `gpt-4.1-mini` are rejected before HTTP. Ignore `MOZAIK_API_KEY`. Node 22+.

---

## Layout

`src/mozaik-live.ts` · `src/replay.ts` · `src/veto.ts` · `src/load-env.ts` · `ui/` · `SUBMISSION.md`
