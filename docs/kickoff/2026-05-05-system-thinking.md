# init-project Capability: System Thinking

Date: 2026-05-05

## User Intent

Create a dedicated repo for evolving the current `init-project` skill into a
global project initialization capability.

The motivating observation is that the existing skill depends too much on prose.
The agent repeatedly thinks through file operations, Markdown insertion, git
setup, GitHub repo creation, and project index maintenance. That makes each run
slower and less deterministic than it needs to be.

## Core Reframe

This is not mainly a prompt-quality problem. It is an architecture problem.

The current skill should evolve from:

```text
long procedural instruction -> model reconstructs operations every time
```

into:

```text
small skill dispatcher -> deterministic CLI subcommands -> append-only state and views
```

The model should handle naming, intent recognition, summary writing, and conflict
explanation. The CLI should handle stable operations: directory creation, file
append, index updates, registry updates, git, GitHub, and device scans.

## Proposed Layers

### 1. Skill Layer

Keep `SKILL.md` short.

Responsibilities:

- trigger on project initialization requests
- collect or infer project name and description
- call the global CLI
- only ask questions for external accounts, destructive actions, secrets, or irreversible publication
- summarize created artifacts

Non-responsibilities:

- reading entire Markdown indexes
- manually deciding insertion points
- reconstructing git/GitHub command sequences each run

### 2. CLI Layer

Provide stable commands that an agent can call without loading much context.

Candidate commands:

```bash
entry project init <name> --desc <text>
entry project upsert-index <name> --lane <lane> --status <status>
entry inbox append --title <title> --raw-file <path>
entry activity append --event project.created --project <name>
entry repo devices
entry repo status --all
```

The CLI should own structured parsing and mutation. Markdown can remain a human
view, but it should not be the only database.

### 3. State Layer

Use append-only data for facts and generate materialized views for humans.

Candidate data:

- project registry
- activity events
- device registry
- repo clone manifests
- sync frontiers
- generated views such as project index, device dashboard, and daily inbox

This follows the existing `entry` direction: preserve leaves, exchange manifests,
then stitch materialized views.

### 4. Agent Harness Layer

Use Flue as a design reference for turning this into a programmable agent
harness instead of only a local skill.

Flue is useful here because it separates:

- model
- harness
- skills
- sessions
- filesystem/sandbox
- CLI or HTTP triggering

That matches the desired shape: a project initialization agent that can run
locally, from CI, or from another app without depending on one chat session.

## Global Usage

The capability should work from any directory.

The user should not need to `cd` into a project root before asking for a new
project. Configuration should resolve the personal project root, GitHub owner,
visibility, entry root, device identity, and sync behavior.

Possible config path:

```text
~/.config/entry/config.toml
```

Possible defaults:

```toml
projects_root = "~/repo/projects"
entry_root = "~/entry"
github_owner = "songlairui"
github_visibility = "private"
device_name = "lary-mbp.local"
```

## Cross-Device Extension

The same capability can grow into a personal project topology system.

Questions it should eventually answer:

- Which repositories exist in the unified project root?
- Which devices have cloned each repository?
- Which device touched a project most recently?
- Which repos are dirty, ahead, behind, or missing remotes?
- Which device/session created or promoted a project?
- Where are sync conflicts present, and what are the preserved branches?

The important rule is to preserve facts, not overwrite history. If two devices
edit independently, record both events and generate a merge note.

## Maintenance Principle

Do not keep expanding the skill prose.

Each time a repeated operation appears, decide whether it belongs in:

- skill text: variable judgment and policy
- CLI command: deterministic repeated operation
- reference doc: background that is only sometimes needed
- generated view: human-readable projection of structured state

The direction is to reduce agent context load over time, not merely make the
instructions more elaborate.

## Suggested Milestones

1. CLI MVP: create project directories, README, kickoff folder, git init, GitHub private repo, first commit and push.
2. Entry integration: append inbox, update project index, append activity event via CLI rather than manual Markdown patches.
3. Global install: make the CLI callable from any directory.
4. Device registry: scan local clones and write device/repo manifests.
5. Skill rewrite: shrink `init-project` into a dispatcher that calls the CLI.
6. Flue prototype: expose project initialization as a programmable agent workflow.
7. Dashboard/view: render project topology and cross-device activity.
