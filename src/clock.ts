export class SharedClock {
  private start = 0;

  reset() {
    this.start = Date.now();
  }

  now() {
    if (!this.start) this.reset();
    return Date.now() - this.start;
  }
}

export const clock = new SharedClock();

export function uid(prefix = "evt"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
