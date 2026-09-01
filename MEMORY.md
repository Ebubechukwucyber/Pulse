# PULSE — Session Memory (handoff)

Any LLM continuing this repo: read `PROJECT.md` first, then this file.  
After your session, append a new dated block at the top (newest first). Do not delete old blocks.

---

## Current head — 2026-09-01 21:45 WAT

### Goal of this session
Stand up the PULSE repo so two non-developers (or another LLM) can continue without inventing architecture.

### What exists now

```
pulse/
  PROJECT.md          source of truth
  MEMORY.md           this file
  README.md
  package.json        zero runtime dependencies; node --experimental-strip-types
  tsconfig.json
  .env.example
  fixtures/incidents/checkout-sevi.json
  fixtures/incidents/auth-gateway-sev2.json
  fixtures/recordings/README.md
  src/events.ts
  src/clock.ts
  src/veto.ts
  src/veto.test.ts
  src/fixture.ts
  src/bus.ts          in-process + SSE fanout (no ws package)
  src/replay.ts       synthesized checkout demo (money shot baked in)
  src/server.ts       HTTP + SSE + static UI
  src/live.ts         Mozaik stub
  src/participants/README.md
  ui/index.html
  ui/app.js           EventSource observer
  ui/styles.css
```

### What works without API keys

```bash
cd pulse
npm run replay
# open http://localhost:8787
```

Or: `node --experimental-strip-types src/server.ts --mode replay`

Expected on the wall:

- clock starts
- roster pills appear
- archaeologist + hypothesis cards overlap in time
- fixer drafts `kubectl delete pod checkout-api --all`
- redteam veto strikes the span
- fixer pivots to pool=50
- commander join / leave + reassign events play
- mitigated end state

`npm test` runs the deterministic veto gate.

### What is NOT done

- [ ] Real `@mozaik-ai/core` participants calling `runInference({ streaming: true })`
- [ ] Live mode is a stub
- [ ] Kill-cam button
- [ ] Human typing → HumanDirective on a live participant
- [ ] Gantt is a simple bar list
- [ ] Fixture B one-click switch
- [ ] Demo recording
- [ ] Public GitHub polish

### Decisions locked

- PULSE only. Do not merge COLOSSEUM.
- Replay first. Live Mozaik second.
- Ids and event names frozen in PROJECT.md.
- UI is a war-room, never a single chat thread.
- Veto gate stays deterministic in `src/veto.ts`.
- Transport is SSE (`/events`), not WebSocket. Zero npm deps for replay.

### Next LLM: do these in order

1. `npm test` then `npm run replay`. Confirm veto in the browser.
2. Wire `src/live.ts` to `@mozaik-ai/core`. First slice: Fixer streaming + RedTeam `onExternalEvent` + `findVeto`.
3. Forward Mozaik events onto `src/bus.ts` so the same UI works.
4. Never break `npm run replay`.
5. Commander input → `HumanDirective`.
6. Better gantt overlap.
7. Record 90s demo only after veto is reliable.

### Commands

```bash
npm run replay
npm run live
npm test
```

### Environment notes

- Original scaffold machine had a broken npm registry; that is why replay has zero dependencies.
- Contest brief still drops Friday 4 Sep 2026. Architecture should survive a fixture swap.
