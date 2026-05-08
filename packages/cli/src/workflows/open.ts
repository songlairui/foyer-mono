import { Effect } from "effect";
import { EntryWorkflowError } from "../domain/errors";
import { expandHome } from "../domain/paths";
import { FileSystem, Shell } from "../services/context";
import { queryActivity } from "./activity";

const CONFIG_PATH = "~/.foyer/config.json";

/** 已知 opener 及其描述，供 set-opener --help 展示 */
export const KNOWN_OPENERS: Record<string, string> = {
  code: "Visual Studio Code",
  cursor: "Cursor",
  zed: "Zed",
  windsurf: "Windsurf",
  idea: "IntelliJ IDEA",
  subl: "Sublime Text",
  atom: "Atom",
};

function configPath(): string {
  return expandHome(CONFIG_PATH);
}

function readConfig(): Effect.Effect<Record<string, unknown>, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const fp = configPath();
    if (!(yield* fs.exists(fp))) return {};
    try {
      return JSON.parse(yield* fs.readFile(fp)) as Record<string, unknown>;
    } catch {
      return {};
    }
  });
}

function writeConfig(
  config: Record<string, unknown>,
): Effect.Effect<void, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    yield* fs.writeFile(configPath(), `${JSON.stringify(config, null, 2)}\n`);
  });
}

/** 设置 opener */
export function setOpener(
  opener: string,
): Effect.Effect<{ humanSummaryZh: string }, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const config = yield* readConfig();
    config.opener = opener;
    yield* writeConfig(config);
    return {
      humanSummaryZh: `已设置 opener 为 "${opener}"。使用 foyer open <slug> 打开项目。`,
    };
  });
}

/** 读取已配置的 opener */
export function getOpener(): Effect.Effect<string | undefined, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const config = yield* readConfig();
    const value = config.opener;
    return typeof value === "string" && value.length > 0 ? value : undefined;
  });
}

/** 用配置的 opener 打开项目目录 */
export function openProject(
  slug: string,
): Effect.Effect<{ humanSummaryZh: string }, EntryWorkflowError, FileSystem | Shell> {
  return Effect.gen(function* () {
    const opener = yield* getOpener();
    if (!opener) {
      return yield* Effect.fail(
        new EntryWorkflowError(
          "INVALID_INPUT",
          "尚未设置 opener。请先运行 foyer set-opener <opener> 选择编辑器。",
          {
            candidates: Object.keys(KNOWN_OPENERS).join(", "),
          },
        ),
      );
    }

    // 从 activity events 中查找项目本地路径
    const events = yield* queryActivity({ limit: 1000 });
    let projectPath: string | undefined;

    for (const event of events) {
      if (
        event.project === slug &&
        (event.event === "project.created" || event.event === "project.initialized")
      ) {
        const p = event.data?.["projectPath"];
        if (typeof p === "string" && p.length > 0) {
          projectPath = p;
          break;
        }
      }
    }

    if (!projectPath) {
      return yield* Effect.fail(
        new EntryWorkflowError("ENTRY_TARGET_MISSING", `未找到项目 "${slug}" 的本地路径。`, {
          slug,
        }),
      );
    }

    const fs = yield* FileSystem;
    if (!(yield* fs.exists(projectPath))) {
      return yield* Effect.fail(
        new EntryWorkflowError("ENTRY_TARGET_MISSING", `项目路径不存在: ${projectPath}`, {
          slug,
          projectPath,
          hint: `请先运行 foyer repo prepare ${slug} 将仓库 clone 到本地。`,
        }),
      );
    }

    const shell = yield* Shell;
    if (!(yield* shell.commandExists(opener))) {
      return yield* Effect.fail(
        new EntryWorkflowError(
          "SHELL_COMMAND_FAILED",
          `opener "${opener}" 命令不可用。请确认已安装。`,
          {
            opener,
          },
        ),
      );
    }

    yield* shell.run(opener, [projectPath], { allowFailure: true });

    return {
      humanSummaryZh: `已在 ${opener} 中打开 ${slug} (${projectPath})`,
    };
  });
}
