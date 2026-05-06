import { z } from "zod";

export const VisibilitySchema = z.enum(["private", "public", "internal"]);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const OwnerSchema = z.enum(["me", "wife", "both"]);
export type Owner = z.infer<typeof OwnerSchema>;

export const ProjectSlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "项目名必须是 kebab-case，只能包含小写字母、数字和连字符");

export const ProjectInitRequestSchema = z.object({
  slug: ProjectSlugSchema,
  description: z.string().min(1, "项目描述不能为空").max(2000),
  lane: z.string().min(1).max(120).default("project"),
  owner: OwnerSchema.default("me"),
  projectsRoot: z.string().optional(),
  foyerRoot: z.string().optional(),
  entryRoot: z.string().optional(),
  githubOwner: z.string().optional(),
  githubVisibility: VisibilitySchema.default("private"),
  createGithub: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  deviceName: z.string().optional()
});

export type ProjectInitRequest = z.infer<typeof ProjectInitRequestSchema>;

export const RuntimeConfigSchema = z.object({
  projectsRoot: z.string(),
  entryRoot: z.string(),
  githubOwner: z.string().optional(),
  githubVisibility: VisibilitySchema,
  deviceName: z.string()
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export const PlanStepSchema = z.object({
  id: z.string(),
  titleZh: z.string(),
  detailZh: z.string(),
  effect: z.enum(["check", "write", "shell", "network", "derived"]),
  status: z.enum(["planned", "skipped", "done"])
});

export type PlanStep = z.infer<typeof PlanStepSchema>;

export const ProjectInitPlanSchema = z.object({
  kind: z.literal("project-init-plan"),
  request: ProjectInitRequestSchema,
  config: RuntimeConfigSchema,
  projectPath: z.string(),
  entryPaths: z.object({
    eventFile: z.string(),
    projectPage: z.string(),
    projectIndex: z.string(),
    inboxFile: z.string(),
    derivedRoot: z.string()
  }),
  steps: z.array(PlanStepSchema),
  warnings: z.array(z.string()),
  humanSummaryZh: z.string()
});

export type ProjectInitPlan = z.infer<typeof ProjectInitPlanSchema>;

export const ActivityEventTypeSchema = z.enum([
  "project.created",
  "project.initialized",
  "inbox.appended",
  "project.indexed",
  "decision.recorded",
  "activity.exported"
]);

export type ActivityEventType = z.infer<typeof ActivityEventTypeSchema>;

export const ActivityEventSchema = z.object({
  id: z.string(),
  ts: z.string(),
  device: z.string(),
  event: ActivityEventTypeSchema,
  project: z.string().optional(),
  lane: z.string().optional(),
  owner: OwnerSchema.optional(),
  summary: z.string(),
  raw_ref: z.string().optional(),
  source: z.string().optional(),
  parents: z.array(z.string()).default([]),
  data: z.record(z.string(), z.unknown()).default({}),
  hash: z.string()
});

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

export const ProjectInitResultSchema = z.object({
  kind: z.literal("project-init-result"),
  request: ProjectInitRequestSchema,
  projectPath: z.string(),
  repositoryUrl: z.string().optional(),
  entryEventPath: z.string(),
  views: z.object({
    projectPage: z.string(),
    projectIndex: z.string(),
    inboxFile: z.string()
  }),
  steps: z.array(PlanStepSchema),
  activityEvent: ActivityEventSchema,
  humanSummaryZh: z.string()
});

export type ProjectInitResult = z.infer<typeof ProjectInitResultSchema>;

export const ProjectListRequestSchema = z.object({
  foyerRoot: z.string().optional(),
  entryRoot: z.string().optional(),
  limit: z.number().int().positive().max(1000).default(1000)
});

export type ProjectListRequest = z.infer<typeof ProjectListRequestSchema>;

export const ProjectListItemSchema = z.object({
  slug: ProjectSlugSchema,
  description: z.string(),
  lane: z.string().optional(),
  owner: OwnerSchema.optional(),
  projectPath: z.string().optional(),
  repositoryUrl: z.string().optional(),
  createdAt: z.string(),
  createdEventId: z.string(),
  latestEventAt: z.string().optional(),
  latestEventId: z.string().optional()
});

export type ProjectListItem = z.infer<typeof ProjectListItemSchema>;

export const ProjectListResultSchema = z.object({
  kind: z.literal("project-list-result"),
  entryRoot: z.string(),
  projects: z.array(ProjectListItemSchema),
  humanOutputZh: z.string(),
  humanSummaryZh: z.string()
});

export type ProjectListResult = z.infer<typeof ProjectListResultSchema>;

export const ActivityQuerySchema = z.object({
  entryRoot: z.string().optional(),
  project: z.string().optional(),
  event: ActivityEventTypeSchema.optional(),
  since: z.string().optional(),
  limit: z.number().int().positive().max(1000).default(100)
});

export type ActivityQuery = z.infer<typeof ActivityQuerySchema>;

export const ActivityExportTargetSchema = z.enum(["graphify-corpus", "hyperextract-input", "hyperextract-ka", "fts-index"]);
export type ActivityExportTarget = z.infer<typeof ActivityExportTargetSchema>;

export const ActivityExportSchema = z.object({
  entryRoot: z.string().optional(),
  scope: z.string(),
  target: ActivityExportTargetSchema,
  out: z.string().optional()
});

export type ActivityExport = z.infer<typeof ActivityExportSchema>;
