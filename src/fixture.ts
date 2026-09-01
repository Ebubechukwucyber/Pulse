import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface IncidentFixture {
  id: string;
  service: string;
  symptom: string;
  errorRate: number;
  p99ms: number;
  deployAgeMin: number;
  tag: string;
  rawLines: string[];
  repoSnippets: { path: string; quote: string }[];
  forbiddenSpans: string[];
  acceptedFixHints: string[];
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadIncident(name = "checkout-sevi"): IncidentFixture {
  const file = join(root, "fixtures", "incidents", `${name}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as IncidentFixture;
}
