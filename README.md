# entry-init-project

Global project initialization capability for the personal `entry` workflow.

This repo is the future home for a more deterministic replacement of the current
text-only `init-project` skill. The goal is to turn project creation from a
model-reasoned procedure into a small, reliable system:

- a global CLI that can initialize projects from any working directory
- low-context subcommands for inbox, project index, git, GitHub, and device registry operations
- a concise skill layer that routes intent and delegates deterministic work to the CLI
- an agent harness design, likely using Flue, for repeatable local, CI, or HTTP-triggered workflows
- cross-device project topology views showing where repositories are cloned and recently active

## Why This Exists

The current `init-project` skill works, but it is mostly prose. Each run asks a
code agent to reconstruct the same file and repository operations from text.
This is especially expensive when updating Markdown indexes, because the agent
often has to read a whole file, decide where to insert, and generate a patch.

This project extracts those repeated operations into stable commands so the
agent spends its tokens on judgment rather than mechanical file surgery.

## Initial Shape

```text
entry-init-project/
  README.md
  docs/
    kickoff/
      2026-05-05-system-thinking.md
      references.md
```

## Intended Direction

The first useful milestone is a CLI MVP:

```bash
entry project init "project-name" --desc "..."
entry inbox append --lane agent_loop_research --project project-name
entry project upsert-index project-name
entry repo devices
entry repo status --all
```

After that, the existing `init-project` skill can shrink to a thin dispatcher:
identify intent, choose or generate a project name, call the CLI, and summarize
the result.
