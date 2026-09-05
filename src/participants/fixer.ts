import { bus } from "../bus.ts";
import { clock, uid } from "../clock.ts";

export class Fixer {
  readonly id = "fixer" as const;
  abort = new AbortController();

  async stream(draftId: string, text: string, chunk = 3, ms = 40) {
    let full = "";
    for (let i = 0; i < text.length; i += chunk) {
      if (this.abort.signal.aborted) return full;
      const delta = text.slice(i, i + chunk);
      full += delta;
      bus.emit({
        id: uid(),
        t_ms: clock.now(),
        type: "FixDraftDelta",
        from: "fixer",
        to: "broadcast",
        payload: { draftId, delta, fullSoFar: full },
      });
      await new Promise((r) => setTimeout(r, ms));
    }
    return full;
  }

  resetAbort() {
    this.abort = new AbortController();
  }
}
