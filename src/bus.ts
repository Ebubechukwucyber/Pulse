import type { ServerResponse } from "node:http";
import type { BusEvent } from "./events.ts";

type Handler = (event: BusEvent) => void;

export class PulseBus {
  private handlers = new Set<Handler>();
  private clients = new Set<ServerResponse>();
  readonly log: BusEvent[] = [];

  on(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  attachSse(res: ServerResponse) {
    this.clients.add(res);
    for (const ev of this.log) this.write(res, ev);
    res.on("close", () => this.clients.delete(res));
  }

  emit(event: BusEvent) {
    this.log.push(event);
    for (const h of this.handlers) {
      try {
        h(event);
      } catch (err) {
        console.error("bus handler error", err);
      }
    }
    for (const res of this.clients) this.write(res, event);
  }

  private write(res: ServerResponse, event: BusEvent) {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      this.clients.delete(res);
    }
  }

  reset() {
    this.log.length = 0;
  }
}

export const bus = new PulseBus();
