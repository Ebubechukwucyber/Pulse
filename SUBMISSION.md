# Submission paste

## Project name

PULSE

## Short description

Incident command room for a checkout SEV1. Archaeologist, Hypothesis and Fixer start Mozaik `runLoop`s on the same incident without waiting. RedTeam vetoes a dangerous `kubectl delete` so Fixer pivots. Replay runs with no API key.

## How the concurrent agents work

Four agents join one `@mozaik-ai/core` runtime. A Commander human declares the SEV1. Archaeologist, Hypothesis and Fixer each call `runLoop` on that message before any of them finish. Each start emits `LoopStarted` with shared `t_ms`. Outputs map by participant id onto `EvidenceFound`, `HypothesisPosted`, and `FixDraftFinal`. `findVeto` in `src/veto.ts` can emit `VetoIssued` and force `FixPivoted`. The wall only renders bus events.

Six panels are not six paid models. Sentry and Triage are the incident header. RedTeam is on the runtime and scores the draft.

## Why this is not a pipeline

Investigation, hypothesis, and remediation start from the same event. Review is not a later stage. Replay: `npm run replay` then http://localhost:8787. Live: `npm run live` with `gemini-3.5-flash`. Grep `runLoop` in `src/mozaik-live.ts`.

## Demo steps

1. `npm install && npm run replay`
2. Watch overlap, the struck-through delete, the safer pool restore
3. Press Kill-cam
4. Join as Commander, send one line, Leave
5. Optional: `npm test` and open `src/mozaik-live.ts`
