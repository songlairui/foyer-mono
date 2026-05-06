import { Effect, Layer } from "effect";
import { Clock, Shell, type CommandResult, type ShellService } from "./context";

export function fixedClock(date: Date) {
  return Layer.succeed(Clock, {
    now: () => Effect.succeed(date)
  });
}

export function fakeShell(options: {
  missing?: readonly string[];
  failCommands?: Record<string, { exitCode: number; stderr: string }>;
  onRun?: (command: string, args: readonly string[], cwd?: string) => void;
} = {}) {
  const service: ShellService = {
    commandExists: (command) => Effect.succeed(!(options.missing ?? []).includes(command)),
    run: (command, args, runOptions) =>
      Effect.sync(() => {
        options.onRun?.(command, args, runOptions?.cwd);
        const key = [command, ...args].join(" ");
        const failure = options.failCommands?.[key] ?? options.failCommands?.[command];
        if (failure && !runOptions?.allowFailure) {
          throw new Error(failure.stderr);
        }

        const result: CommandResult = failure
          ? { exitCode: failure.exitCode, stdout: "", stderr: failure.stderr }
          : { exitCode: 0, stdout: "", stderr: "" };
        return result;
      })
  };

  return Layer.succeed(Shell, service);
}
