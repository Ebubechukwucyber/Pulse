# PULSE

**The dangerous command dies before it finishes being written.**

PULSE is a live incident command room built around concurrent agents.

`checkout-api` is in SEV1 immediately after a deploy. Multiple specialists investigate the same incident at the same time. Archaeologist searches for evidence. Hypothesis develops possible causes. Fixer prepares remediation. RedTeam watches for dangerous actions and can veto them, forcing the room to pivot.

You are the Commander. You can join the incident, issue a directive, and leave.

Not a chatbot. Not a sequential pipeline. The product is the overlap—and the veto.

Built for **JigJoy × daily.dev × Hyperskill — Build Systems of Concurrent Agents**.

---

## Run it in 60 seconds

Deterministic replay — no API key required.

```bash
npm install
npm run replay
```

Open http://localhost:8787 and watch.

| Time | What happens |
| --- | --- |
| 0s | `checkout-api` enters SEV1 after a deploy |
| ~2s | Sentry and Triage establish the incident |
| ~2s onward | Archaeologist and Hypothesis work concurrently |
| ~4s | Fixer begins proposing a dangerous `kubectl delete` command |
| Immediately | RedTeam detects and vetoes the dangerous span |
| After the veto | Fixer pivots toward a safer remediation |
| Any time | Commander can join, send a directive, or leave |

Controls: **R** restart · **K** Kill-cam (seconds around the veto) · `npm test` veto detector.

`npm run replay` is intentionally deterministic so a judge can run the full demonstration without credentials. The repository separately contains the real Mozaik concurrent-agent implementation (`src/mozaik-live.ts`).

---

## The problem

A production incident does not happen in a neat pipeline.

At 3am a human war room might have one engineer reading logs, another investigating the deploy, another proposing a fix, and someone saying *do not run that against production*.

Most multi-agent demos serialize that work: search → analyze → propose → review. By the time the reviewer appears, the dangerous command may already exist.

PULSE asks: what if those specialists were active **concurrently** in the same room? The result is not more agents talking. It is overlapping investigation, competing action, and intervention before a bad remediation becomes the outcome.

---

## How PULSE works

```
                    COMMANDER (human directive)
                              |
                              v
                 SHARED INCIDENT  (event bus + t_ms)
                 /              |               \
        ARCHAEOLOGIST     HYPOTHESIS            FIXER
          evidence          causes           remediation
                 \              |               /
                              v
                         FIX DRAFT
                              |
                           REDTEAM
                      /               \
                   SAFE            DANGEROUS
                     |                 |
                 continue         VetoIssued
                                       |
                                  FixPivoted
                                       |
                              safer remediation
```

All participants operate around a shared incident clock, `t_ms`. The UI does not invent activity. Every visible state is derived from events that entered the room.

---

## The incident roster

| Participant | Role |
| --- | --- |
| Sentry | Raises the alarm and publishes raw incident evidence |
| Triage | Sets severity and explains the impact |
| Archaeologist | Investigates logs and repository evidence |
| Hypothesis | Develops possible root causes |
| Fixer | Drafts remediation |
| RedTeam | Detects dangerous remediation and issues a veto |
| Comms / Facts | Reports only what has already landed |
| Commander | Human who can join, direct, and leave |

**Clarification:** the six visible specialist panels are not six independent paid LLM calls. The concurrency claim is specific: Archaeologist, Hypothesis, and Fixer launch concurrent Mozaik `runLoop`s on the same SEV1. RedTeam and Commander participate in that room.

---

## The money shot: the veto

Fixer drafts:

```
kubectl delete pod checkout-api --all
```

PULSE does not paint the entire response red. The deterministic detector identifies that span. The room emits:

```
FixDraftFinal → findVeto() → VetoIssued → FixPivoted → safer remediation
```

The safer path restores `PG_POOL_SIZE=50` and limits recovery to a canary instead of deleting production workload.

Fixer proposes. RedTeam constrains. The outcome changes. That causal chain is why the agents exist concurrently.

---

## Why this is not a chatbot

| A typical pipeline | PULSE |
| --- | --- |
| One stage waits for the previous | Specialists begin on the same incident together |
| Search finishes before analysis | Archaeologist and Hypothesis can overlap |
| A reviewer sees the completed proposal | RedTeam can alter the outcome |
| Canned dashboard copy | Facts only render landed events |
| Human hidden in a prompt | Commander is a real participant |
| Concurrency is animation | Overlap timeline is event timestamps |

If the agents never overlap, the concurrency implementation is wrong. If the entire Fixer response is marked dangerous instead of the detected span, the veto implementation is wrong.

---

## Proof of concurrency

Inspect `src/mozaik-live.ts`.

On the same Commander-declared SEV1, Archaeologist, Hypothesis, and Fixer are launched without waiting for one another:

```
infer("archaeologist", ...)
infer("hypothesis", ...)
infer("fixer", ...)
```

Each path enters its own Mozaik `runLoop`. `LoopStarted` records `t_ms`. Those timestamps drive the Facts rail, activity ticks, and overlap swimlane — not CSS delays.

```bash
grep -n "runLoop" src/mozaik-live.ts
```

---

## Event architecture

The bus is the shared state of the room: `IncidentDeclared`, `SeveritySet`, `RosterChanged`, `LoopStarted`, `EvidenceFound`, `HypothesisPosted`, `FixDraftDelta`, `FixDraftFinal`, `VetoIssued`, `FixPivoted`, `HumanDirective`, `ParticipantLeftWork`, `IncidentMitigated`.

The wall observes. It does not manufacture metrics.

---

## The war-room wall

**Header** — service, severity, error rate, p99, deploy age, incident clock. Replay and Kill-cam.

**Tick row** — a name lights when that participant emits.

**Sentry** — `IncidentDeclared` (alarm + raw lines).

**Triage** — `SeveritySet` (severity + why).

**Archaeologist** — `EvidenceFound`.

**Hypothesis** — `HypothesisPosted`.

**Fixer** — `FixDraftDelta` / `FixDraftFinal`. Only the dangerous span is marked.

**RedTeam** — `VetoIssued` (reason + span).

**Facts / Comms** — right rail. Only landed events, including `LoopStarted`.

**Overlap** — swimlane from shared timestamps. Stacked bars = overlapping work.

**Commander** — bottom bar. Join, type a directive, Send, Leave. Status on the right is the latest bus event.

---

## Deterministic safety detector

The veto is not delegated entirely to an LLM. `src/veto.ts` matches dangerous patterns (`kubectl delete`, `drop table`, `rm -rf`, …) and returns the span so the UI can strike exactly that text.

```bash
npm test
```

---

## Live Mozaik mode

Real `@mozaik-ai/core` path: runtime, `createAgent`, `createHuman`, `join`, concurrent `runLoop`. Archaeologist, Hypothesis, and Fixer on the same SEV1. RedTeam scores Fixer output with `findVeto`. Commander is a human participant.

```bash
npm install @mozaik-ai/core
```

`.env` next to `package.json` (do not commit):

```
GEMINI_API_KEY=your-key
PULSE_MODEL_FAST=gemini-3.5-flash
PULSE_PORT=8787
```

```powershell
$env:GEMINI_API_KEY="your-key"
$env:PULSE_MODEL_FAST="gemini-3.5-flash"
npm run live
```

Allowlisted model ids in this Mozaik build: `gemini-3.5-flash`, `gemini-3.1-pro-preview`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.5`, `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-7`, `claude-opus-4-8`, `deepseek-v4-flash`, `deepseek-v4-pro`.

Unsupported names (Groq/Llama/`gpt-4.1-mini`) fail before HTTP. Ignore `MOZAIK_API_KEY` (telemetry). Node 22+. Strip-only TypeScript — no constructor parameter properties. Live uses `streaming: false`.

---

## What PULSE does and does not claim

| Claim | Status |
| --- | --- |
| Deterministic replay | Works without API keys |
| Incident wall and SSE observer | Included |
| Shared incident timeline | Included |
| Span-level dangerous-command veto | Included (replay mid-line; live on available Fixer text) |
| Kill-cam | Included |
| Human Commander | Included |
| Unit-tested veto detector | Included |
| Three concurrent Mozaik `runLoop`s | Implemented in `src/mozaik-live.ts` |
| Live output mapped by known participant id | Implemented |
| Live mid-token interception | **Not claimed** |
| Six independent LLMs at once | **Not claimed** |
| Public hosted URL | **Not claimed** — localhost |

Live Gemini streaming crashes this Mozaik build (`inference_streaming`). Replay is the visual mid-line veto. Live applies the same `findVeto` logic to available Fixer output.

---

## How to judge quickly

1. `npm install && npm run replay`
2. Watch overlap, the dangerous command, and the veto pivot
3. `npm test`
4. Open `src/mozaik-live.ts` and search `runLoop`

---

## Why this is a concurrency project

Investigation, root-cause reasoning, remediation, and safety review should not wait for one another. The architecture makes that overlap visible. The bus makes the room observable. The detector makes intervention reliable. The Commander stays in the system.

The goal is not to make agents talk. The goal is to make concurrent work change the outcome of an incident.

---

## Layout

`src/mozaik-live.ts` live concurrent agents · `src/replay.ts` deterministic fixture · `src/veto.ts` detector · `src/load-env.ts` env · `ui/` wall · `PROJECT.md` spec · `MEMORY.md` handoff · `SUBMISSION.md` form copy.
