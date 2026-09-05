# PULSE

**The fixer does not get to finish a dangerous command. RedTeam cuts it while the tokens are still arriving.**

PULSE is a live incident command room. One SEV1 on `checkout-api` fans out to specialists who work on the same clock: search, hypotheses, a fix draft, a stream intercept, and a status line built only from facts that already landed. The human can join, type a directive, and leave. Work that was theirs is reassigned. Nobody waits in a queue.

**Judge it in 90 seconds ↗** · **Run locally ↗** · **What is real ↗** · **Why this is not a chatbot ↗**

Built for **JigJoy × daily.dev × Hyperskill — Build Systems of Concurrent Agents**, 5–6 Sep 2026.

---

## Proof of concurrency

File: `src/mozaik-live.ts`.

On one commander SEV1, Archaeologist, Hypothesis and Fixer each call `runLoop` **without waiting for the others**. Each start emits `LoopStarted` on the shared bus with `t_ms`. The overlap lanes and Facts rail render those events. They are not CSS delays.

```
infer("archaeologist", ...)  // LoopStarted then runLoop
infer("hypothesis", ...)
infer("fixer", ...)
```

Identity for live output is `participant.getId()` stored at `join`, not `producerName`.

Wall mapping:

- Archaeologist → `EvidenceFound`
- Hypothesis → `HypothesisPosted`
- Fixer → `FixDraftDelta` / `FixDraftFinal`
- `findVeto` → `VetoIssued` → commander-shaped `VETO` message → Fixer `FixPivoted` and a second safe `runLoop`

`npm run replay` is the no-key proof of the same wall. `npm run live` is the Mozaik `runLoop` proof (`gemini-3.5-flash` unless `PULSE_MODEL_FAST` is set).

Grep: `runLoop` and `LoopStarted` in `src/mozaik-live.ts`.

**Six panels is not six model calls.** Sentry and Triage are the incident header (fixture events). Archaeologist, Hypothesis and Fixer are the three concurrent `runLoop`s. RedTeam is on the same runtime and vetoes the draft; it is not a fourth billed loop unless a pivot runs. Commander is the labeled human bar at the bottom.

---

## Judge it in 90 seconds

```bash
git clone https://github.com/YOUR_USER/pulse.git
cd pulse
npm run replay
```

Open [http://localhost:8787](http://localhost:8787). Do not click around first. Watch.

| Clock | What must be true on the wall |
| --- | --- |
| ~0s | `checkout-api` declared. Error / p99 / deploy age come from the fixture, not decoration. |
| ~2s | Archaeologist and Hypothesis emit close enough that both ticks are hot. |
| ~4s | Fixer starts typing `kubectl delete pod checkout-api --all`. |
| mid-line | RedTeam veto. Only that span is struck through. The rest of the draft stays. |
| after | Pivot to restore `PG_POOL_SIZE=50` and bounce the canary only. |
| end | Commander joins, sends one line, leaves. Open work is handed off. |

Then press **Kill-cam**. It replays the three seconds before the veto from the event log. That is the shot.

`R` replays the fixture. `K` is kill-cam.

```bash
npm test
```

Veto patterns are unit-tested. If this test is red, the demo is lying.

---

## The problem

Incident tools still run as a pipeline: search, then guess, then patch, then review. Review happens after the command exists. That is how a model writes `kubectl delete … --all` and nobody is listening until the paragraph is done.

Mozaik is not interesting if you put six labels on a sequential bot. It is interesting if one participant can stop another **during generation**, if two streams occupy the same millisecond, and if a human can walk in and out without freezing the room.

---

## What I built

A war-room observer plus a deterministic replay bus.

- Shared event log. Every panel reads the same events. Nothing is invented in the UI.
- Specialists as participants, not chat turns: Sentry, Triage, Archaeologist, Hypothesis, Fixer, RedTeam, Comms, Commander.
- RedTeam is a stream intercept. It scores the draft as characters arrive and fires `VetoIssued` at `atChar`.
- Commander bar is on the bus: Join / Leave / Send emit `RosterChanged` and `HumanDirective`.
- Swimlane is timestamps from the bus, merged into blocks. Overlap is visible with the sound off.

The product is the veto, not the theme.

---

## Why this is not a chatbot

A renamed chat app has one completion, then the next. PULSE fails that test on purpose.

| If it were a pipeline | What PULSE does instead |
| --- | --- |
| Search finishes, then a hypothesis starts | Both subscribe to `IncidentDeclared` and emit on their own clocks |
| A reviewer reads the finished command | RedTeam listens to `FixDraftDelta` and cuts mid-string |
| Status is a canned paragraph | Comms may only cite facts already on the bus |
| Human is a system prompt | Human is a participant who can join and leave |

If two agent ticks are never hot at the same time, the build is wrong. If the whole Fixer paragraph goes red instead of the dangerous span, the build is wrong.

---

## What is real

| Claim | Status |
| --- | --- |
| Replay fixture, veto, swimlane, kill-cam, commander bar | Working now. No API key. No npm dependencies. Node 22+. |
| Dangerous-command detector (`src/veto.ts`) | Working. Covered by `npm test`. |
| Event contract (`src/events.ts`) | Frozen. UI may not invent fields. |
| Live Mozaik inference (`npm run live`) | Stub. `src/live.ts` is the next wiring. Do not demo live as if models are talking yet. |
| Hosted public URL | Not claimed here. Run local. |

Same rule damishafe uses: the contest verification bar and the product flow are the same flow. Replay is not a cartoon of a future demo. It is the demo until live is wired.

---

## Architecture

```
fixture or live agents
        │
        ▼
   event bus (SSE)
        │
        ├── Fixer draft
        ├── RedTeam intercept  ── veto at atChar
        ├── Facts rail
        ├── Overlap swimlane
        └── Commander join / leave / directive
```

Clock is shared. `t_ms` is elapsed from incident start. Kill-cam slices the in-memory log. It does not fabricate a second timeline.

---

## Project layout

```
PROJECT.md          frozen spec — other LLMs start here
MEMORY.md           session handoff
src/events.ts       bus contract
src/veto.ts         dangerous span detector
src/replay.ts       checkout SEV1 fixture
src/bus.ts          in-process + SSE
src/server.ts       static UI + /events + /api/*
src/live.ts         Mozaik stub
ui/                 war-room observer
fixtures/incidents/ seeded payloads
```

---

## Run locally

Node 22 or newer.

```bash
npm run replay          # http://localhost:8787
npm test                # veto detector
```

`npm run live` prints the stub status. It will not call a model until `src/live.ts` is implemented against `@mozaik-ai/core`.

---

## Docs for the next session

- `PROJECT.md` — do not contradict it.
- `MEMORY.md` — append what you changed.

If you are an LLM continuing this repo: do not replace the veto with a chatbot, do not invent metrics in the UI, and do not mark live mode as done until overlapping token streams are visible on the wall.
