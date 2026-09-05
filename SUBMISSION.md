# PULSE — submission copy (paste into the form)

## Project name
PULSE

## Short description
Incident command where a fixer streams a mitigation and RedTeam cuts a dangerous command before the line is finished. Two Mozaik agents, one runtime, one shared clock.

## How the concurrent agents work
Fixer and RedTeam `join` the same Mozaik runtime. Fixer `runLoop`s with `streaming: true`. Every `inference.stream` chunk is visible to RedTeam at the same time. RedTeam runs `findVeto` on the text so far. On a hit it publishes `VetoIssued` and an `InterceptionHandler` steers Fixer's loop to `idle` so the rest of `kubectl delete … --all` never lands. The commander is a Mozaik human: join, send one directive, leave. Replay is the no-key backup of the same wall.

## Why this is not a pipeline
Review does not wait for a finished command. Intercept is on the token stream. Archaeologist/hypothesis overlap is shown on the swimlane in replay. Kill-cam replays the three seconds before the veto from the event log.

## Demo (90s)
1. `npm run live` if `@mozaik-ai/core` and a key are present, else `npm run replay`
2. Open http://localhost:8787
3. Watch two ticks hot, then the strike-through on only the dangerous span
4. Press Kill-cam
5. Join, type `page payments on-call too`, Send, Leave
