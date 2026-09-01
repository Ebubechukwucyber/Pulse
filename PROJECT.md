# PULSE — Project Source of Truth

**Read this file before writing or changing code.**  
If a change contradicts this file, the file wins unless MEMORY.md records an explicit decision.

## One sentence

When an incident fires, specialist agents join one Mozaik `AgenticEnvironment` and work at the same time. A RedTeam agent cuts a dangerous fix **while tokens are still appearing**. A human commander can join and leave; work is reassigned. The product is the overlapping timeline, not a chatbot.

## Tagline (UI + README + demo end card)

> The dangerous command dies before it finishes being written.

## Contest

- Event: AI Hackathon — Build Systems of Concurrent Agents (JigJoy × daily.dev × Hyperskill)
- Build window: 5–6 September 2026. Kickoff brief: 4 September. Submit evening of 6 September.
- Submit: GitHub repo + short demo (75–110 seconds).
- Published judging signal: genuine concurrency — agents that actually run together, not a sequential pipeline in disguise.
- Runtime they want to see: `@mozaik-ai/core` (Mozaik). Do not wrap LangGraph / CrewAI / Python.

## What we are building (and not)

Building:

- Live incident command swarm named **PULSE**
- Observer war-room UI (not a chat thread)
- Deterministic fixture pack + `--replay` with no API keys
- Mid-stream veto as the money shot

Not building:

- Real Datadog / PagerDuty / Slack OAuth
- baro clone (goal → PR)
- 12 agents
- A sequential “Sentry then Investigator then Fixer” graph

## Frozen participant ids

| id | kind | model | listens | job |
|---|---|---|---|---|
| sentry | agent or fixture player | none / cheap | fixture | emits `IncidentDeclared` |
| triage | agent | strong | sentry, human, errors | severity, join/leave workers, reassign |
| archaeologist | agent | cheap + tools | incident, hypotheses | repo + log search → `EvidenceFound` |
| hypothesis | agent | strong | evidence, incident | rival theories → `HypothesisPosted` |
| fixer | agent | strong, **streaming on** | hypotheses, evidence, veto | drafts runbook / command |
| redteam | agent | strong + **deterministic gate** | Fixer stream deltas only | `VetoIssued` mid-token |
| comms | agent | cheap | evidence, veto, human | status from facts only |
| wall | observer | none | everything | UI process, no inference |
| commander | human | none | — | join, type, leave |

Do not rename these ids. Do not add agents before the money shot works.

## Event catalog (packages/events contract)

Every bus item the UI sees:

```ts
type BusEvent = {
  id: string;
  t_ms: number;          // shared clock from env start, not Date.now() per agent
  type: string;
  from: string;
  to?: string | "broadcast";
  payload: unknown;
};
```

Types:

- `IncidentDeclared` — sentry — `{ id, service, symptom, errorRate, p99ms, deployAgeMin, rawLines[] }`
- `SeveritySet` — triage — `{ sev, reason }`
- `RosterChanged` — triage — `{ joined[], left[], reason }`
- `EvidenceFound` — archaeologist — `{ kind, quote, path, confidence }`
- `HypothesisPosted` — hypothesis — `{ hid, title, claim, confidence }`
- `HypothesisUpdated` — hypothesis — `{ hid, confidence, note }`
- `FixDraftDelta` — fixer / stream adapter — `{ draftId, delta, fullSoFar }`
- `FixDraftFinal` — fixer — `{ draftId, text, kind }`
- `VetoIssued` — redteam — `{ draftId, atChar, reason, dangerousSpan }`
- `FixPivoted` — fixer — `{ draftId, from, to, reason }`
- `StatusDrafted` — comms — `{ channel, text, factsUsed[] }`
- `HumanDirective` — commander — `{ text }`
- `ParticipantLeftWork` — triage — `{ who, openTasks[], reassignedTo }`
- `IncidentMitigated` — triage / commander — `{ summary, survivingFix }`
- `AgentError` — any — `{ who, err, attempt, next }`

Prefer pumping native Mozaik `onExternalEvent` (`response.output_text.delta`) into `FixDraftDelta` rather than a side channel.

## Veto gate (must work without a model)

Fire `VetoIssued` if the growing draft matches any of:

- `kubectl delete`
- `drop table`
- `rm -rf`
- `terraform destroy`
- `chmod 777`
- disable auth / skip TLS
- `--force` on prod namespace
- fixture `forbiddenSpans[]`

Dual gate: regex/AST first (reliable on camera), model reason string second.

Demo guarantee: Fixer is seeded with a dangerous prefix so the veto always happens. Document this in DEMO.md as staging, not fraud.

## Fixture A (demo) — `fixtures/incidents/checkout-sevi.json`

- Service: `checkout-api`
- Symptom: p99 2400ms, error rate 18%, deploy 14 min ago, tag `v1.18.4`
- Smoking gun: connection pool silently changed 50 → 8
- Red herring: Redis timeout downstream
- Forbidden fix: `kubectl delete pod checkout-api --all` or full payments rollback
- Correct direction: restore pool to 50, bounce canary only, saturation alert

## Fixture B (spare)

`auth-gateway` SEV2 — JWKS cache stampede after key rotation. Forbidden: disable JWT verification. Correct: warm cache + jittered refresh.

## UI law

- Dark ops wall. Slate + amber + one red veto flash.
- Top bar: incident, severity, **shared clock** `mm:ss.s`, participant pills that glow when they last emitted (<400ms).
- Left: roster (green inferring / amber tool / grey left / red error).
- Center: pinned transcripts. Default pin Fixer + RedTeam. Veto strikes the dangerous span at `atChar`.
- Right: evidence cards + hypothesis confidence.
- Bottom: commander input + Join / Leave (real participant lifecycle).
- Under fold: gantt swimlane by `t_ms`. Overlap must be obvious.
- Kill-cam: replay last 8 seconds around veto from JSONL.
- Ban a single chat column as the primary view.

## Demo script (90 seconds)

| t | picture |
|---|---|
| 0–8s | Inject checkout SEV1. Empty transcripts. |
| 8–18s | Roster pills appear via `RosterChanged`. |
| 18–38s | Archaeologist + Hypothesis stream together. Two theories. |
| 38–55s | Fixer writes `kubectl delete…`. RedTeam veto. Hold 3 seconds. Silence. |
| 55–72s | Fixer pivots to pool=50 + canary. Comms uses only facts. |
| 72–85s | Human joins, types “page payments on-call too”, leaves, reassign toast. |
| 85–95s | Mitigated. End card with hard number: veto at char N, clock time. |

## Stack

- Node 20+, TypeScript, ESM
- Runtime: `@mozaik-ai/core` for live mode
- Replay mode: **no keys required** (JSONL / fixture player)
- UI: static war-room served by the Node process (no second build required)
- Transport: WebSocket `/ws` forwarding every `BusEvent`

## Scripts

```
npm run replay    # fixture + recorded/synthesized events, no keys
npm run live      # Mozaik + models (needs .env)
npm run dev       # replay + watch
npm test          # veto gate + overlap windows
```

## Win tests (must stay true)

1. Two agents emit in the same wall-clock second. Clock + two transcripts prove it.
2. Mid-stream intercept changes the outcome (veto).
3. Join or leave reassigns work.
4. UI is an Observer, not an inferring agent.
5. README section: “Why this cannot be a sequential pipeline.”
6. `--replay` / `npm run replay` works with no API keys.

## Why this cannot be a sequential pipeline

A sequential runbook declares the incident, waits for search, waits for one hypothesis, drafts a fix, then reviews the fix. Review comes after the command exists.

PULSE makes review a live subscriber on the token stream. Archaeologist and Hypothesis react to the same `IncidentDeclared`. Comms writes from the fact log as events land. When the human leaves, ownership changes. None of that is a DAG of awaits.

## Handoff rule for any LLM

1. Read PROJECT.md (this file) and MEMORY.md.
2. Do not rename events or participant ids.
3. Do not replace the UI with a chat app.
4. Do not add agents until veto + replay work.
5. After every session, append MEMORY.md: what landed, what is broken, exact next command.
6. Paste terminal errors verbatim. Do not invent Mozaik APIs that are not in `@mozaik-ai/core`.
