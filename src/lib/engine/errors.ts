export type RunErrorCode = "noAgents" | "cardMissing" | "alreadyDecided" | "missingAnswer";

export class RunInputError extends Error {
  constructor(
    readonly code: RunErrorCode,
    readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}
