import path from "node:path";
import { Effect } from "effect";
import {
  SendInboxRequestSchema,
  SendInboxResultSchema,
  type SendInboxResult,
} from "../domain/contracts";
import { EntryWorkflowError, invalidInput } from "../domain/errors";
import { resolveConfig, todayParts } from "../domain/paths";
import { Clock, FileSystem } from "../services/context";
import { appendActivity } from "./activity";
import { listProjects } from "./project-init";

export function appendInbox(input: {
  entryRoot?: string;
  deviceName?: string;
  project: string;
  rawFile?: string;
  text?: string;
}): Effect.Effect<
  { inboxFile: string; humanSummaryZh: string },
  EntryWorkflowError,
  FileSystem | Clock
> {
  return Effect.gen(function* () {
    const config = resolveConfig({ entryRoot: input.entryRoot, deviceName: input.deviceName });
    const fs = yield* FileSystem;
    const clock = yield* Clock;
    const now = yield* clock.now();

    yield* fs.ensureDir(config.entryRoot);

    const content = input.rawFile ? yield* fs.readFile(input.rawFile) : (input.text ?? "");
    const parts = todayParts(now);
    const inboxFile = path.join(config.entryRoot, "inbox", parts.yyyy, parts.mm, `${parts.ymd}.md`);
    yield* fs.appendFile(
      inboxFile,
      `\n## ${now.toISOString()} ${input.project}\n\n${content.trim()}\n`,
    );
    yield* appendActivity({
      entryRoot: config.entryRoot,
      deviceName: config.deviceName,
      event: "inbox.appended",
      project: input.project,
      summary: `追加 inbox 记录：${input.project}`,
    });

    return {
      inboxFile,
      humanSummaryZh: `已追加 inbox：${input.project}`,
    };
  });
}

export function sendInbox(
  input: unknown,
): Effect.Effect<SendInboxResult, EntryWorkflowError, FileSystem | Clock> {
  return Effect.gen(function* () {
    const parsed = SendInboxRequestSchema.safeParse(input);
    if (!parsed.success) return yield* Effect.fail(invalidInput(parsed.error));

    const request = parsed.data;
    const config = resolveConfig({ foyerRoot: request.foyerRoot, entryRoot: request.entryRoot });
    const fs = yield* FileSystem;
    const clock = yield* Clock;
    const now = yield* clock.now();

    // 1. 调用 listProjects 解析目标 projectPath
    const projectList = yield* listProjects({
      foyerRoot: request.foyerRoot,
      entryRoot: request.entryRoot,
    });
    const targetProject = projectList.projects.find((p) => p.slug === request.targetSlug);

    if (!targetProject || !targetProject.projectPath) {
      return yield* Effect.fail(
        new EntryWorkflowError(
          "TARGET_NOT_LOCAL",
          `目标项目 ${request.targetSlug} 未在本机初始化。`,
        ),
      );
    }

    if (!(yield* fs.exists(targetProject.projectPath))) {
      return yield* Effect.fail(
        new EntryWorkflowError(
          "TARGET_NOT_LOCAL",
          `目标项目路径 ${targetProject.projectPath} 不存在。`,
        ),
      );
    }

    // 2. 生成文件名
    const timestamp = now.toISOString().replace(/[:.]/g, "").replace("T", "-").slice(0, 15); // YYYYMMDD-HHMMSS
    const randomHex = Math.random().toString(16).slice(2, 8);
    const titleKebab = request.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const filename = `${timestamp}-${request.type}-${titleKebab}.md`;
    const targetFile = path.join(targetProject.projectPath, "_inbox", "tapped", filename);

    if (yield* fs.exists(targetFile)) {
      return yield* Effect.fail(
        new EntryWorkflowError(
          "FILE_ALREADY_EXISTS",
          `目标文件 ${targetFile} 已存在，请稍后重试。`,
        ),
      );
    }

    // 3. 渲染内容
    const content = request.rawFile ? yield* fs.readFile(request.rawFile) : (request.text ?? "");
    const sourceSlug = request.sourceProject ?? "unknown";
    const shortId = `${timestamp.slice(0, 8)}-${sourceSlug}-${randomHex}`;

    const fileContent = `---
id: ${shortId}
created: ${now.toISOString()}
title: ${request.title}
type: ${request.type}
source: ${sourceSlug}
status: tapped
---

${content.trim()}
`;

    // 4. 写入文件
    yield* fs.ensureDir(path.dirname(targetFile));
    yield* fs.writeFile(targetFile, fileContent);

    // 5. 写入 activity event
    yield* appendActivity({
      entryRoot: config.entryRoot,
      deviceName: request.deviceName,
      event: "inbox.sent",
      project: sourceSlug,
      data: {
        targetProject: request.targetSlug,
        targetFile: targetFile,
        type: request.type,
        title: request.title,
      },
      summary: `向 ${request.targetSlug} 投递 ${request.type}：${request.title}`,
    });

    const result: SendInboxResult = {
      kind: "send-inbox-result",
      targetSlug: request.targetSlug,
      targetFile,
      type: request.type,
      title: request.title,
      humanSummaryZh: `已向 ${request.targetSlug} 投递 ${request.type}：${request.title}`,
    };

    return SendInboxResultSchema.parse(result);
  });
}
