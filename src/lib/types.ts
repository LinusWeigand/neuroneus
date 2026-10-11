import type { ProjectSpec } from "@/lib/spec/templates";

export type DecisionOption = {
  label: string;
  description: string;
  recommended: boolean;
  championedBy: string[];
  value?: string;
};

export type DecisionQuestion = {
  id: string;
  header: string;
  question: string;
  options: DecisionOption[];
};

export type DecisionAnswer = {
  questionId: string;
  header: string;
  question: string;
  choice: string;
  isCustom: boolean;
  wasRecommended: boolean;
  value?: string;
};

export type DecisionCard = {
  type: "decision_card";
  status: "pending" | "answered" | "superseded";
  summary: string;
  questions: DecisionQuestion[];
  answers?: DecisionAnswer[];
};

export type DecisionAnswerData = {
  type: "decision_answer";
  requestMessageId: string;
  answers: DecisionAnswer[];
};

export type RepoLogData = {
  type: "repo_log";
  count: number;
  repo: string;
  url: string;
};

export type BuildNoteData =
  | { type: "build_started"; round: number; steps: string[] }
  | { type: "build_done"; round: number; done: number; total: number; url: string | null; budget?: boolean }
  | { type: "build_failed"; round: number; reason: string }
  | { type: "task_rolled_back"; round: number; title: string }
  | { type: "spec_complete"; kind: "web_app" | "web_game"; design: string | null }
  | { type: "art_ready"; style: string; conceptUrl: string };

export type BuildStatus = "queued" | "setup" | "art" | "planning" | "building" | "done" | "failed" | "cancelled";
export type BuildPhase = "implement" | "fix" | "deploy" | "verify";

export type Verification = {
  works: boolean;
  visualScore: number | null;
  problems: string[];
  notes: string[];
  screenshots: string[];
  url: string;
  checkedAt: string;
};

export type ProjectArt = { style: string; styleName: string; conceptUrl: string; titleUrl: string | null; dimension: "2d" | "3d" };

export type BuildTask = {
  id: string;
  title: string;
  detail: string;
  agentId: string;
  status: "pending" | "working" | "done" | "failed" | "skipped";
  summary?: string;
  verification?: Verification;
  polished?: boolean;
};

export type BuildActivity = {
  kind:
    | "setup"
    | "art"
    | "planning"
    | "thinking"
    | "listing"
    | "reading"
    | "searching"
    | "writing"
    | "editing"
    | "deleting"
    | "schema"
    | "deploying"
    | "verifying"
    | "judging"
    | "shipping";
  agentId?: string;
  path?: string;
  chars?: number;
  query?: string;
  stage?: string;
  since: string;
};

export type BuildEventKind =
  | "listed"
  | "read"
  | "searched"
  | "wrote"
  | "edited"
  | "deleted"
  | "finished"
  | "continued"
  | "planned"
  | "deploy_started"
  | "deploy_ready"
  | "deploy_failed"
  | "rolled_back"
  | "art_ready"
  | "verified"
  | "verify_failed"
  | "shipped";

export type BuildEventDTO = {
  id: number;
  taskIndex: number | null;
  agentId: string | null;
  kind: BuildEventKind;
  path: string | null;
  detail: string | null;
  createdAt: string;
};

export type BuildDTO = {
  id: string;
  round: number;
  kind: "setup" | "build";
  status: BuildStatus;
  phase: BuildPhase | null;
  taskIndex: number;
  tasks: Omit<BuildTask, "detail">[];
  error: string | null;
  activity: BuildActivity | null;
  phaseStartedAt: string | null;
  tokens: number;
  createdAt: string;
  updatedAt: string;
};

export type UsagePurpose =
  | "chat"
  | "huddle_plan"
  | "card"
  | "spec"
  | "database"
  | "design"
  | "design_brief"
  | "plan"
  | "build";

export type UsageSummary = {
  chat: { input: number; cached: number; output: number; calls: number };
  build: { input: number; cached: number; output: number; calls: number };
  rounds: { round: number; tokens: number; createdAt: string }[];
};

export type StatusKey = "reading" | "preparing";

export type MessageDTO = {
  id: string;
  seq: number;
  authorType: "user" | "agent" | "moderator";
  agentId: string | null;
  kind: "chat" | "decision_request" | "decision_answer" | "note";
  content: string;
  data: DecisionCard | DecisionAnswerData | RepoLogData | BuildNoteData | null;
  createdAt: string;
};

export type DecisionDTO = {
  id: string;
  header: string;
  question: string;
  choice: string;
  isCustom: boolean;
  wasRecommended: boolean;
  createdAt: string;
};

export type ProjectDTO = {
  id: string;
  name: string;
  vision: string;
  agentIds: string[];
  repoFullName: string | null;
  repoUrl: string | null;
  repoError: string | null;
  appUrl: string | null;
  hasDatabase: boolean;
  builderModel: string | null;
  spec: ProjectSpec | null;
  designSlug: string | null;
  art: ProjectArt | null;
  infraError: string | null;
  running: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RunEvent =
  | { type: "run"; runId: string }
  | { type: "message"; message: MessageDTO }
  | { type: "typing"; agentId: string }
  | { type: "start"; id: string; agentId: string; createdAt: string }
  | { type: "delta"; id: string; text: string }
  | { type: "end"; message: MessageDTO }
  | { type: "discard"; id: string }
  | { type: "status"; label: StatusKey | null }
  | { type: "decisions"; decisions: DecisionDTO[] }
  | { type: "repo"; label: string; url: string }
  | { type: "error"; error: string }
  | { type: "done" };

export type TurnInput =
  | { kind: "message"; content: string }
  | { kind: "answers"; requestMessageId: string; answers: DecisionAnswer[] };
