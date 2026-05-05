import path from "node:path";
import { Effect } from "effect";
import { EntryWorkflowError } from "../domain/errors";
import { resolveConfig, todayParts } from "../domain/paths";
import { Clock, FileSystem } from "../services/context";
import { appendActivity } from "./activity";

export function appendInbox(input: {
  entryRoot?: string;
  deviceName?: string;
  project: string;
  rawFile?: string;
  text?: string;
}): Effect.Effect<{ inboxFile: string; humanSummaryZh: string }, EntryWorkflowError, FileSystem | Clock> {
  return Effect.gen(function* () {
    const config = resolveConfig({ entryRoot: input.entryRoot, deviceName: input.deviceName });
    const fs = yield* FileSystem;
    const clock = yield* Clock;
    const now = yield* clock.now();

    if (!(yield* fs.exists(config.entryRoot))) {
      return yield* Effect.fail(new EntryWorkflowError("ENTRY_TARGET_MISSING", "entry 写入目标不存在。", { entryRoot: config.entryRoot }));
    }

    const content = input.rawFile ? yield* fs.readFile(input.rawFile) : input.text ?? "";
    const parts = todayParts(now);
    const inboxFile = path.join(config.entryRoot, "inbox", parts.yyyy, parts.mm, `${parts.ymd}.md`);
    yield* fs.appendFile(inboxFile, `\n## ${now.toISOString()} ${input.project}\n\n${content.trim()}\n`);
    yield* appendActivity({
      entryRoot: config.entryRoot,
      deviceName: config.deviceName,
      event: "inbox.appended",
      project: input.project,
      summary: `追加 inbox 记录：${input.project}`
    });

    return {
      inboxFile,
      humanSummaryZh: `已追加 inbox：${input.project}`
    };
  });
}
