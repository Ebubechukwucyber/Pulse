# PULSE

Live incident command swarm. Agents work at the same time. A RedTeam veto kills a dangerous command before it finishes being written.

Contest: JigJoy × daily.dev × Hyperskill — Build Systems of Concurrent Agents (Sep 5–6 2026).

## Run (no API keys, no npm packages)

Node 22+ required.

```bash
npm run replay
```

Open http://localhost:8787

You should see two streams move, then a red veto on `kubectl delete pod checkout-api --all`.

Replay button in the UI restarts the fixture.

## Docs for builders / other LLMs

- `PROJECT.md` — frozen spec. Do not contradict it.
- `MEMORY.md` — where we stopped. Append after every session.

## Live mode

`npm run live` is not wired to Mozaik yet. Replay is the working demo path.

## Why this cannot be a sequential pipeline

A sequential SRE bot waits for search, then a single hypothesis, then a fix, then a review. The review happens after the command exists. PULSE puts RedTeam on the token stream. Archaeologist and Hypothesis react to the same incident event. Comms writes from facts as they land. That is the product.
