/**
 * Live Mozaik wiring — STUB.
 *
 * Next LLM: implement participants with @mozaik-ai/core here.
 * Keep npm run replay working. Do not delete replay.
 *
 * Target first live slice:
 * 1. AgenticEnvironment
 * 2. Fixer runInference({ streaming: true })
 * 3. RedTeam onExternalEvent → findVeto → VetoIssued on PulseBus
 * 4. Forward every Mozaik-relevant event onto src/bus.ts so the same UI works
 */

export function liveStatus(): string {
  return [
    "LIVE MODE IS A STUB.",
    "Install @mozaik-ai/core and wire Fixer + RedTeam first.",
    "See PROJECT.md roster and MEMORY.md next steps.",
    "Use npm run replay for the working demo.",
  ].join(" ");
}
