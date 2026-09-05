# PULSE

**The fixer does not get to finish a dangerous command.**

PULSE is an incident command room. `checkout-api` is in SEV1 after a deploy. Several specialists work on **one clock**. Three of them start a Mozaik `runLoop` without waiting for each other. RedTeam can veto a cluster-wide delete so Fixer has to pivot. You are Commander: join, type one order, leave.

Not a chatbot. The product is the overlap and the veto.

JigJoy x daily.dev x Hyperskill — concurrent agents, 5-6 Sep 2026.

---

## In one minute

A real war room at 3am: one person greps logs, one argues the cause, one types `kubectl`, one says do not wipe prod. Today that is Slack and a risky paste. PULSE is that room with agents that do not take turns.

| Who | Job |
| --- | --- |
| Sentry | Raises the alarm |
| Triage | Sets SEV1 |
| Archaeologist | Pulls log and repo evidence |
| Hypothesis | States competing causes |
| Fixer | Writes the mitigation |
| RedTeam | Cuts a dangerous command |
| Comms / Facts | Only repeats what already landed |
| Commander | You |

**Contest claim:** three concurrent `runLoop`s (Archaeologist, Hypothesis, Fixer) on one runtime, plus RedTeam, plus a human. Six panels on the wall are **not** six paid models.

---

## Run the demo (no API key)

```bash
npm install
npm run replay
```

Open http://localhost:8787. Hard-refresh. Watch before you click.

| When | You should see |
| --- | --- |
| 0s | Header: checkout-api, error %, p99, deploy age |
| ~2s | Sentry + Triage text. Archaeologist and Hypothesis both hot |
| ~4s | Fixer types `kubectl delete pod checkout-api --all` |
| mid-line | Only that span goes red and is struck through |
| after | Safer fix: restore `PG_POOL_SIZE=50`, bounce canary |
| you | Commander bar: Join, type, Send, Leave |

**Kill-cam** / `K` replays the seconds around the veto. `R` restarts. `npm test` must stay green.

---

## The wall (what each label is)

**Header** — service name, SEV1, **error** (failing request %), **p99** (slow tail latency), **deploy** (minutes since release), **clock** (time in this incident). Replay and Kill-cam buttons.

**Tick row** — a name lights when that participant just emitted an event.

**Sentry** — raw alarm and log lines (`IncidentDeclared`).

**Triage** — severity and why (`SeveritySet`).

**Archaeologist** — quoted evidence (`EvidenceFound`).

**Hypothesis** — the working theory (`HypothesisPosted`).

**Fixer** — the draft command (`FixDraftDelta`). Dangerous span is marked, not the whole paragraph.

**RedTeam** — veto reason and the span it cut (`VetoIssued`).

**Facts / Comms** — right column. Only events that already happened, including `LoopStarted` times.

**Overlap** — swimlane from bus timestamps. Two bars stacked = they worked at the same time.

**Commander** — bottom bar. Human participant. Status text on the **right** is the last bus event (`VetoIssued ← redteam`), not a second page.

---

## The problem

Most "multi-agent" demos are a pipeline: search, then guess, then patch, then review. Review starts after the command exists. That is how `kubectl delete … --all` gets written with nobody listening.

Mozaik only matters if two loops occupy the same millisecond and one participant can change the outcome of another.

---

## Why this is not a chatbot

| If it were a pipeline | What PULSE does |
| --- | --- |
| Search finishes, then a guess starts | Archaeologist and Hypothesis `runLoop` on the same SEV1 |
| A reviewer reads the finished command | RedTeam is already on the runtime and can veto |
| Status is a canned paragraph | Facts only show events that landed |
| Human is a system prompt | Human is `createHuman`: join, send, leave |

If two ticks are never hot together, the build is wrong. If the whole Fixer paragraph goes red, the build is wrong.

---

## Proof of concurrency

Grep `src/mozaik-live.ts`.

On one commander SEV1, three calls fire **without waiting**:

```
infer("archaeologist", ...)   // LoopStarted, then runLoop
infer("hypothesis", ...)
infer("fixer", ...)
```

`LoopStarted` carries shared `t_ms`. The Facts rail and overlap lanes render those events. Not CSS delays.

Live output is mapped by `participant.getId()` stored at `join`, not by `producerName`.

```
FixDraftFinal → findVeto() → VetoIssued → VETO message → FixPivoted → safe runLoop
```

---

## What is real

| Claim | Status |
| --- | --- |
| Replay wall, span veto, swimlane, kill-cam, commander | Works. No key. |
| `src/veto.ts` | Works. `npm test`. |
| Live `@mozaik-ai/core` three `runLoop`s | Works with an allowlisted model that has credit. |
| Mid-token intercept on **live** Gemini | Not claimed. Streaming crashes this Mozaik build. Replay still shows mid-line veto. |
| Public host | Not claimed. Localhost. |
| Six models at once | False. |

---

## Live mode (optional, needs a key)

```bash
npm install @mozaik-ai/core
```

`.env` next to `package.json` (do not commit):

```
GEMINI_API_KEY=
PULSE_MODEL_FAST=gemini-3.5-flash
PULSE_PORT=8787
```

Or PowerShell:

```powershell
$env:GEMINI_API_KEY="your-key"
$env:PULSE_MODEL_FAST="gemini-3.5-flash"
npm run live
```

This package only accepts: `gemini-3.5-flash`, `gemini-3.1-pro-preview`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.5`, `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-7`, `claude-opus-4-8`, `deepseek-v4-flash`, `deepseek-v4-pro`.

Groq / Llama / `gpt-4.1-mini` fail before any HTTP call. Ignore `MOZAIK_API_KEY` (telemetry). Live uses `streaming: false`.

Need **Node 22+**. No constructor parameter properties (strip-only mode).

---

## Why this should win

The brief already names a live ops room. Concurrency is grepable. Replay needs no key. The veto is an SRE instinct, not a debate club. The README does not pretend six panels are six models.

---

## Layout

`PROJECT.md` spec · `MEMORY.md` handoff · `SUBMISSION.md` form paste · `src/mozaik-live.ts` weekend substance · `src/replay.ts` fixture · `src/veto.ts` detector · `ui/` wall.
