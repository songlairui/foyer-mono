import crypto from "node:crypto";
import path from "node:path";
import type { ActivityEvent, ProjectInitRequest, RuntimeConfig } from "./contracts";
import { relativeToEntry } from "./paths";

export function renderProjectReadme(request: ProjectInitRequest): string {
  return `# ${request.slug}

${request.description}

## 项目状态

- lane: ${request.lane}
- owner: ${request.owner}
- 初始化方式: foyer project init

## 目录

\`\`\`text
.
├── README.md
└── docs/
    └── kickoff/
\`\`\`

## 下一步

把启动资料放入 \`docs/kickoff/\`，再用项目页或 activity context 继续推进。
`;
}

export function renderProjectPage(request: ProjectInitRequest, projectPath: string, event: ActivityEvent): string {
  return `# ${request.slug}

## 当前摘要

${request.description}

## 元数据

- owner: ${request.owner}
- lane: ${request.lane}
- local_path: ${projectPath}
- latest_event: ${event.id}
- status: active

## 下一步

- 补充 \`docs/kickoff/\` 启动资料。
- 用 \`foyer activity context --project ${request.slug} --budget 6000 --format markdown\` 生成低上下文继续材料。

## Activity Sources

- ${event.raw_ref ?? "activity event"}
`;
}

export function renderInboxEntry(request: ProjectInitRequest, event: ActivityEvent): string {
  return `\n## ${event.ts} ${request.slug}\n\n- event: ${event.event}\n- lane: ${request.lane}\n- owner: ${request.owner}\n- summary: ${event.summary}\n- event_id: ${event.id}\n`;
}

export function renderIndexLine(request: ProjectInitRequest, projectPagePath: string): string {
  const href = path.basename(projectPagePath);
  return `- [${request.slug}](${href}) - ${request.description}（lane: ${request.lane}, owner: ${request.owner}）`;
}

export function makeActivityEvent(input: {
  event: ActivityEvent["event"];
  request: ProjectInitRequest;
  config: RuntimeConfig;
  summary: string;
  rawRef?: string;
  source?: string;
  data?: Record<string, unknown>;
  now: Date;
}): ActivityEvent {
  const base = {
    ts: input.now.toISOString(),
    device: input.config.deviceName,
    event: input.event,
    project: input.request.slug,
    lane: input.request.lane,
    owner: input.request.owner,
    summary: input.summary,
    raw_ref: input.rawRef,
    source: input.source,
    parents: [],
    data: input.data ?? {}
  };
  const hash = hashObject(base);

  return {
    id: `evt_${hash.slice(0, 24)}`,
    ...base,
    hash: `sha256:${hash}`
  };
}

export function eventRawRef(config: RuntimeConfig, eventFile: string): string {
  return relativeToEntry(config, eventFile);
}

export function hashObject(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
