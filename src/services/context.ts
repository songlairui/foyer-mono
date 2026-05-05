import { Context, Effect, Layer } from "effect";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { filesystemError, shellCommandFailed, type EntryWorkflowError } from "../domain/errors";

export interface StatInfo {
  isDirectory: boolean;
  isFile: boolean;
  mtimeMs: number;
}

export interface FileSystemService {
  exists(filePath: string): Effect.Effect<boolean, EntryWorkflowError>;
  ensureDir(dirPath: string): Effect.Effect<void, EntryWorkflowError>;
  readFile(filePath: string): Effect.Effect<string, EntryWorkflowError>;
  writeFile(filePath: string, content: string): Effect.Effect<void, EntryWorkflowError>;
  appendFile(filePath: string, content: string): Effect.Effect<void, EntryWorkflowError>;
  listFiles(root: string): Effect.Effect<string[], EntryWorkflowError>;
  stat(filePath: string): Effect.Effect<StatInfo, EntryWorkflowError>;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ShellService {
  commandExists(command: string): Effect.Effect<boolean, EntryWorkflowError>;
  run(
    command: string,
    args: readonly string[],
    options?: { cwd?: string; allowFailure?: boolean }
  ): Effect.Effect<CommandResult, EntryWorkflowError>;
}

export interface ClockService {
  now(): Effect.Effect<Date>;
}

export class FileSystem extends Context.Tag("entry/FileSystem")<FileSystem, FileSystemService>() {}
export class Shell extends Context.Tag("entry/Shell")<Shell, ShellService>() {}
export class Clock extends Context.Tag("entry/Clock")<Clock, ClockService>() {}

export const NodeFileSystemLive = Layer.succeed(FileSystem, {
  exists: (filePath) =>
    Effect.tryPromise({
      try: async () => {
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      },
      catch: (cause) => filesystemError("exists", filePath, cause)
    }),
  ensureDir: (dirPath) =>
    Effect.tryPromise({
      try: () => fs.mkdir(dirPath, { recursive: true }).then(() => undefined),
      catch: (cause) => filesystemError("ensureDir", dirPath, cause)
    }),
  readFile: (filePath) =>
    Effect.tryPromise({
      try: () => fs.readFile(filePath, "utf8"),
      catch: (cause) => filesystemError("readFile", filePath, cause)
    }),
  writeFile: (filePath, content) =>
    Effect.tryPromise({
      try: async () => {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, "utf8");
      },
      catch: (cause) => filesystemError("writeFile", filePath, cause)
    }),
  appendFile: (filePath, content) =>
    Effect.tryPromise({
      try: async () => {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.appendFile(filePath, content, "utf8");
      },
      catch: (cause) => filesystemError("appendFile", filePath, cause)
    }),
  listFiles: (root) =>
    Effect.tryPromise({
      try: () => listFilesRecursive(root),
      catch: (cause) => filesystemError("listFiles", root, cause)
    }),
  stat: (filePath) =>
    Effect.tryPromise({
      try: async () => {
        const value = await fs.stat(filePath);
        return {
          isDirectory: value.isDirectory(),
          isFile: value.isFile(),
          mtimeMs: value.mtimeMs
        };
      },
      catch: (cause) => filesystemError("stat", filePath, cause)
    })
});

export const NodeShellLive = Layer.succeed(Shell, {
  commandExists: (command) =>
    Effect.gen(function* () {
      const result = yield* runCommand("command", ["-v", command], { allowFailure: true });
      return result.exitCode === 0;
    }),
  run: (command, args, options) => runCommand(command, args, options)
});

export const SystemClockLive = Layer.succeed(Clock, {
  now: () => Effect.sync(() => new Date())
});

export const NodeServicesLive = Layer.mergeAll(NodeFileSystemLive, NodeShellLive, SystemClockLive);

function runCommand(
  command: string,
  args: readonly string[],
  options: { cwd?: string; allowFailure?: boolean } = {}
): Effect.Effect<CommandResult, EntryWorkflowError> {
  return Effect.async<CommandResult, EntryWorkflowError>((resume) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      shell: false,
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      resume(Effect.fail(shellCommandFailed(command, args, 127, error.message)));
    });
    child.on("close", (code) => {
      const exitCode = code ?? 1;
      const result = { exitCode, stdout, stderr };
      if (exitCode !== 0 && !options.allowFailure) {
        resume(Effect.fail(shellCommandFailed(command, args, exitCode, stderr)));
        return;
      }
      resume(Effect.succeed(result));
    });
  });
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const current = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(current)));
    } else if (entry.isFile()) {
      files.push(current);
    }
  }

  return files;
}
