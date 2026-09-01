export interface VetoHit {
  atChar: number;
  dangerousSpan: string;
  reason: string;
}

const RULES: { pattern: RegExp; reason: string }[] = [
  { pattern: /kubectl\s+delete/i, reason: "cluster delete is wider than the implicated service" },
  { pattern: /drop\s+table/i, reason: "destructive datastore command" },
  { pattern: /rm\s+-rf/i, reason: "recursive delete" },
  { pattern: /terraform\s+destroy/i, reason: "infra destroy" },
  { pattern: /chmod\s+777/i, reason: "world-writable permissions" },
  { pattern: /disable\s+auth/i, reason: "auth disabled" },
  { pattern: /skip\s+tls/i, reason: "TLS skipped" },
  { pattern: /--force/i, reason: "forced prod mutation" },
];

export function findVeto(fullSoFar: string, extraSpans: string[] = []): VetoHit | null {
  const hay = fullSoFar;
  for (const span of extraSpans) {
    if (!span) continue;
    const at = hay.toLowerCase().indexOf(span.toLowerCase());
    if (at >= 0) {
      return {
        atChar: at,
        dangerousSpan: hay.slice(at, at + span.length),
        reason: `forbidden span from fixture: ${span}`,
      };
    }
  }
  for (const rule of RULES) {
    const m = rule.pattern.exec(hay);
    if (m && m.index >= 0) {
      return {
        atChar: m.index,
        dangerousSpan: m[0],
        reason: rule.reason,
      };
    }
  }
  return null;
}
