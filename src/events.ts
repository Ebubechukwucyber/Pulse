export type ParticipantId =
  | "sentry"
  | "triage"
  | "archaeologist"
  | "hypothesis"
  | "fixer"
  | "redteam"
  | "comms"
  | "wall"
  | "commander";

export type BusEventType =
  | "IncidentDeclared"
  | "SeveritySet"
  | "RosterChanged"
  | "EvidenceFound"
  | "HypothesisPosted"
  | "HypothesisUpdated"
  | "FixDraftDelta"
  | "FixDraftFinal"
  | "VetoIssued"
  | "FixPivoted"
  | "StatusDrafted"
  | "HumanDirective"
  | "ParticipantLeftWork"
  | "IncidentMitigated"
  | "AgentError";

export interface BusEvent<T = unknown> {
  id: string;
  t_ms: number;
  type: BusEventType;
  from: ParticipantId | "fixture" | "system";
  to?: ParticipantId | "broadcast";
  payload: T;
}

export interface IncidentDeclared {
  id: string;
  service: string;
  symptom: string;
  errorRate: number;
  p99ms: number;
  deployAgeMin: number;
  rawLines: string[];
}

export interface VetoIssued {
  draftId: string;
  atChar: number;
  reason: string;
  dangerousSpan: string;
}

export interface FixDraftDelta {
  draftId: string;
  delta: string;
  fullSoFar: string;
}
