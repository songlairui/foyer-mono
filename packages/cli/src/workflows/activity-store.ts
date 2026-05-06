import path from "node:path";
import { Effect } from "effect";
import type { ActivityEvent, RuntimeConfig } from "../domain/contracts";
import { relativeToEntry } from "../domain/paths";
import { FileSystem } from "../services/context";
import type { EntryWorkflowError } from "../domain/errors";

interface FrontierView {
  device: string;
  stream: string;
  max_seq: number;
  roots: Record<string, string>;
  updated_at: string;
}

interface ManifestView {
  device: string;
  updated_at: string;
  max_seq: number;
  event_files: string[];
  known_hashes: string[];
}

export function writeActivityFact(input: {
  config: RuntimeConfig;
  eventFile: string;
  event: ActivityEvent;
}): Effect.Effect<void, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const hashId = input.event.hash.replace(/^sha256:/, "");
    const nodeFile = path.join(input.config.entryRoot, "activity", "nodes", `${hashId}.json`);
    const frontierFile = path.join(
      input.config.entryRoot,
      "activity",
      "frontier",
      `${safeDevice(input.config.deviceName)}.json`,
    );
    const manifestFile = path.join(
      input.config.entryRoot,
      "activity",
      "manifests",
      `${safeDevice(input.config.deviceName)}.json`,
    );

    yield* fs.appendFile(input.eventFile, `${JSON.stringify(input.event)}\n`);
    yield* fs.writeFile(
      nodeFile,
      `${JSON.stringify(
        {
          hash: input.event.hash,
          order: 0,
          size: 1,
          time_min: input.event.ts,
          time_max: input.event.ts,
          children: [],
          summary: input.event.summary,
          lanes: input.event.lane ? [input.event.lane] : [],
          event_id: input.event.id,
          event_ref: relativeToEntry(input.config, input.eventFile),
        },
        null,
        2,
      )}\n`,
    );

    const frontier = yield* readJson<FrontierView>(frontierFile, {
      device: input.config.deviceName,
      stream: "default",
      max_seq: 0,
      roots: {},
      updated_at: input.event.ts,
    });
    frontier.max_seq += 1;
    frontier.roots["0"] = input.event.hash;
    frontier.updated_at = input.event.ts;
    yield* fs.writeFile(frontierFile, `${JSON.stringify(frontier, null, 2)}\n`);

    const manifest = yield* readJson<ManifestView>(manifestFile, {
      device: input.config.deviceName,
      updated_at: input.event.ts,
      max_seq: 0,
      event_files: [],
      known_hashes: [],
    });
    manifest.updated_at = input.event.ts;
    manifest.max_seq = frontier.max_seq;
    addUnique(manifest.event_files, relativeToEntry(input.config, input.eventFile));
    addUnique(manifest.known_hashes, input.event.hash);
    yield* fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  });
}

function readJson<A>(
  filePath: string,
  fallback: A,
): Effect.Effect<A, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    if (!(yield* fs.exists(filePath))) return fallback;
    try {
      return JSON.parse(yield* fs.readFile(filePath)) as A;
    } catch {
      return fallback;
    }
  });
}

function addUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function safeDevice(deviceName: string): string {
  return deviceName.replace(/[^a-zA-Z0-9._-]/g, "_");
}
