# References

## Local Context

### Current `init-project` Skill

Observed source:

```text
/Users/larysong/.agents/skills/init-project/SKILL.md
```

Current behavior:

- generates or accepts a kebab-case project name
- creates a project directory under `~/repo/projects`
- creates `docs/kickoff/`
- writes a README
- runs `git init`
- creates a same-name private GitHub repository with `gh repo create`
- performs first commit and push

Main limitation:

The workflow is described as prose, so each agent run has to reconstruct the
same mechanical operations.

### Entry Protocols

Relevant local references:

```text
/Users/larysong/entry/protocol/DEFAULT_ENTRY.md
/Users/larysong/entry/protocol/SYNC_BINOMIAL_FOREST.md
```

Ideas to carry forward:

- raw user language is append-only
- summaries are derived views
- projects are promoted from durable seeds
- activity events record created/promoted/archived/connected artifacts
- cross-device sync should preserve leaves and stitch views rather than delete branches
- frontiers/manifests make multi-device state cheap to connect

## External References

### Flue

Website:

- https://flueframework.com/

Repository:

- https://github.com/withastro/flue

Useful design ideas:

- agent equals model plus programmable harness
- skills can be invoked as reusable workflows with structured output
- agents can run from CLI, local development server, or HTTP endpoint
- sandbox/filesystem behavior is part of the harness design
- sensitive tokens can stay outside the agent session and be injected only into controlled shell/API calls

Why it matters for this repo:

`entry-init-project` needs to stop being only a chat skill. Flue offers a useful
mental model for packaging it as a controllable agent workflow with a clear
boundary between model judgment and deterministic execution.

## Candidate Prior Art To Inspect Later

These are not yet evaluated; they are placeholders for kickoff research.

- existing Codex skill structure and bundled scripts pattern
- GitHub CLI project creation flows
- local config conventions: XDG config, `~/.config/entry/config.toml`
- git worktree and clone discovery
- small CLI frameworks for TypeScript or Python
- materialized Markdown views generated from JSONL events
