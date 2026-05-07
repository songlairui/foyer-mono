import { Cause, Exit } from "effect";
import type { z } from "zod";

export type ErrorCode =
  | "INVALID_INPUT"
  | "DIRECTORY_ALREADY_EXISTS"
  | "ENTRY_TARGET_MISSING"
  | "GH_UNAVAILABLE"
  | "GIT_UNAVAILABLE"
  | "REMOTE_REPO_EXISTS"
  | "NETWORK_FAILURE"
  | "ENTRY_WRITE_CONFLICT"
  | "SHELL_COMMAND_FAILED"
  | "FILESYSTEM_ERROR"
  | "UNSUPPORTED_EXPORT_TARGET"
  | "TARGET_NOT_LOCAL"
  | "FILE_ALREADY_EXISTS";

const EXIT_CODES: Record<ErrorCode, number> = {
  INVALID_INPUT: 2,
  DIRECTORY_ALREADY_EXISTS: 10,
  ENTRY_TARGET_MISSING: 11,
  GH_UNAVAILABLE: 20,
  GIT_UNAVAILABLE: 21,
  REMOTE_REPO_EXISTS: 22,
  NETWORK_FAILURE: 23,
  ENTRY_WRITE_CONFLICT: 30,
  SHELL_COMMAND_FAILED: 40,
  FILESYSTEM_ERROR: 41,
  UNSUPPORTED_EXPORT_TARGET: 50,
  TARGET_NOT_LOCAL: 60,
  FILE_ALREADY_EXISTS: 61,
};

const RECOVERABLE: Record<ErrorCode, boolean> = {
  INVALID_INPUT: true,
  DIRECTORY_ALREADY_EXISTS: true,
  ENTRY_TARGET_MISSING: true,
  GH_UNAVAILABLE: true,
  GIT_UNAVAILABLE: true,
  REMOTE_REPO_EXISTS: true,
  NETWORK_FAILURE: true,
  ENTRY_WRITE_CONFLICT: true,
  SHELL_COMMAND_FAILED: true,
  FILESYSTEM_ERROR: false,
  UNSUPPORTED_EXPORT_TARGET: true,
  TARGET_NOT_LOCAL: true,
  FILE_ALREADY_EXISTS: true,
};

export class EntryWorkflowError extends Error {
  readonly _tag = "EntryWorkflowError";
  readonly exitCode: number;
  readonly recoverable: boolean;

  constructor(
    readonly code: ErrorCode,
    readonly humanMessageZh: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(humanMessageZh);
    this.name = "EntryWorkflowError";
    this.exitCode = EXIT_CODES[code];
    this.recoverable = RECOVERABLE[code];
  }
}

export const invalidInput = (error: z.ZodError): EntryWorkflowError =>
  new EntryWorkflowError("INVALID_INPUT", "输入参数不合法。", {
    issues: error.issues,
  });

export const filesystemError = (
  operation: string,
  path: string,
  cause: unknown,
): EntryWorkflowError =>
  new EntryWorkflowError("FILESYSTEM_ERROR", "文件系统操作失败。", {
    operation,
    path,
    cause: formatCause(cause),
  });

export const shellCommandFailed = (
  command: string,
  args: readonly string[],
  exitCode: number,
  stderr: string,
): EntryWorkflowError =>
  new EntryWorkflowError("SHELL_COMMAND_FAILED", "外部命令执行失败。", {
    command,
    args,
    exitCode,
    stderr,
  });

export function errorToJson(error: unknown): Record<string, unknown> {
  const workflowError = unwrapWorkflowError(error);

  if (workflowError) {
    return {
      ok: false,
      error: {
        code: workflowError.code,
        messageZh: workflowError.humanMessageZh,
        recoverable: workflowError.recoverable,
        details: workflowError.details,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "UNKNOWN",
      messageZh: "发生未分类错误。",
      recoverable: false,
      details: { cause: formatCause(error) },
    },
  };
}

export function exitCodeFor(error: unknown): number {
  return unwrapWorkflowError(error)?.exitCode ?? 1;
}

export function unwrapWorkflowError(error: unknown): EntryWorkflowError | undefined {
  if (error instanceof EntryWorkflowError) return error;

  if (Exit.isExit(error) && error._tag === "Failure") {
    const failure = Cause.failureOption(error.cause);
    if (failure._tag === "Some" && failure.value instanceof EntryWorkflowError) {
      return failure.value;
    }
  }

  return undefined;
}

function formatCause(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  return JSON.stringify(cause);
}
