import { bus } from "../bus.ts";
import { clock, uid } from "../clock.ts";
import type { BusEvent, FixDraftDelta } from "../events.ts";
import { findVeto } from "../veto.ts";

/**
 * Same job as Mozaik's SafetyReviewerAgent:
 * watch the other participant's stream, abort it, publish VetoIssued.
 */
export class RedTeam {
  readonly id = "redteam" as const;
  fired: Set<string>;
  abortFixer: () => void;
  extraSpans: string[];

  constructor(abortFixer: () => void, extraSpans: string[] = []) {
    this.fired = new Set();
    this.abortFixer = abortFixer;
    this.extraSpans = extraSpans;
  }

  watch() {
    return bus.on((ev: BusEvent) => {
      if (ev.type !== "FixDraftDelta") return;
      const p = ev.payload as FixDraftDelta;
      if (p.draftId !== "draft-1") return;
      if (this.fired.has(p.draftId)) return;
      const hit = findVeto(p.fullSoFar, this.extraSpans);
      if (!hit) return;
      this.fired.add(p.draftId);
      this.abortFixer();
      bus.emit({
        id: uid(),
        t_ms: clock.now(),
        type: "VetoIssued",
        from: "redteam",
        to: "fixer",
        payload: {
          draftId: p.draftId,
          atChar: hit.atChar,
          reason: hit.reason,
          dangerousSpan: hit.dangerousSpan,
        },
      });
    });
  }
}
