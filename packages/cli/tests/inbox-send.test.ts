import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { EntryWorkflowError } from "../src/domain/errors";
import { Clock, FileSystem, NodeFileSystemLive, Shell } from "../src/services/context";
import { fakeShell, fixedClock } from "../src/services/test-context";
import { executeProjectInit } from "../src/workflows/project-init";
import { sendInbox } from "../src/workflows/inbox";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("inbox send workflow", () => {
  it("sends a feature request to a target project", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    const projectsRoot = path.join(root, "projects");

    // 1. Initialize two projects
    await runWithServices(
      executeProjectInit({
        slug: "source-project",
        description: "Source project",
        projectsRoot,
        entryRoot,
      }),
    );
    await runWithServices(
      executeProjectInit({
        slug: "target-project",
        description: "Target project",
        projectsRoot,
        entryRoot,
      }),
    );

    // 2. Send inbox from source to target
    const result = await runWithServices(
      sendInbox({
        targetSlug: "target-project",
        type: "feature-request",
        title: "Test Feature",
        text: "This is a test feature request content.",
        sourceProject: "source-project",
        projectsRoot,
        entryRoot,
      }),
    );

    expect(result.kind).toBe("send-inbox-result");
    expect(result.targetSlug).toBe("target-project");
    expect(result.targetFile).toContain("target-project");
    expect(result.targetFile).toContain("_inbox/tapped");

    // 3. Verify target file content
    const fileContent = await readFile(result.targetFile, "utf8");
    expect(fileContent).toContain("title: Test Feature");
    expect(fileContent).toContain("type: feature-request");
    expect(fileContent).toContain("source: source-project");
    expect(fileContent).toContain("status: tapped");
    expect(fileContent).toContain("This is a test feature request content.");

    // 4. Verify activity event in source foyer
    const date = new Date("2026-05-05T12:00:00.000Z");
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const eventFile = path.join(
      entryRoot,
      "activity",
      "events",
      os.hostname().replace(/[^a-zA-Z0-9._-]/g, "_"),
      yyyy,
      mm,
      `${dd}.jsonl`,
    );

    const events = await readFile(eventFile, "utf8");
    expect(events).toContain('"event":"inbox.sent"');
    expect(events).toContain('"targetProject":"target-project"');
  });

  it("fails when target project is not initialized", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    const projectsRoot = path.join(root, "projects");

    await expect(
      runWithServices(
        sendInbox({
          targetSlug: "non-existent",
          type: "idea",
          title: "Bad Idea",
          text: "Should fail",
          projectsRoot,
          entryRoot,
        }),
      ),
    ).rejects.toThrow();
  });
});

async function tempRoot(): Promise<string> {
  const dir = path.join(os.tmpdir(), `foyer-test-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function runWithServices<A>(
  effect: Effect.Effect<A, EntryWorkflowError, FileSystem | Shell | Clock>,
): Promise<A> {
  return Effect.runPromise(
    effect.pipe(
      Effect.provide(
        Layer.mergeAll(
          NodeFileSystemLive,
          fakeShell(),
          fixedClock(new Date("2026-05-05T12:00:00.000Z")),
        ),
      ),
    ),
  );
}
