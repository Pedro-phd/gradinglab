---
name: groundwork
description: One-time per-project setup for the ship-it pipeline — detects tracker, repo, reviewer and notifier, asks the minimum, writes docs/agents/ config so no other skill ever asks again.
version: 1.2.0
disable-model-invocation: true
---

Antes de executar, leia e siga `/home/digitalscale/.ship-it/AGENTS.md`. Arquivos compartilhados vêm dessa instalação; argumentos relativos e arquivos produzidos pertencem ao projeto atual.

# Skill: groundwork

Lays the groundwork every other skill stands on: the per-project configuration (`/home/digitalscale/.ship-it/shared/workflow-context.md`). Runs once per project; rerunning updates the existing config instead of duplicating it. groundwork writes config as its job — the "offer to persist" write-back protocol governs the *other* skills when they resolve roles ad hoc. Respond in the conversation language (`docs/agents/language.md`; not yet configured → mirror the user's language).

**Load before acting**: `/home/digitalscale/.ship-it/shared/workflow-context.md` (the config this skill writes) and `/home/digitalscale/.ship-it/shared/guardrails.md` — this skill writes project files; the loading contract applies.

## Process

### 1 — Detect (silent, no questions yet)

Run the capability detection from `/home/digitalscale/.ship-it/shared/workflow-context.md` for all four roles plus validation:

- **Tracker**: tracker MCPs by capability signature (never by server prefix); `git remote -v`; `gh auth status` / `glab auth status`; existing `tasks/` directory.
- **Repo**: `git rev-parse --show-toplevel`; remote host; base branch — `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`, falling back to `git symbolic-ref refs/remotes/origin/HEAD`, then `git ls-remote --symref origin HEAD`, then assume `main`. If the assumed base doesn't exist locally either (fresh `git init`), record the current local branch instead and flag the mismatch in `tracker.md` and the handoff.
- **Reviewer**: `.coderabbit.yaml` present, or `gh pr list --search "reviewed-by:coderabbitai" --state all --limit 5` returning results (swap the login to probe other known bots). Treat a failed command and an empty result the same — both mean "no bot detected" (`gh` subcommands are inconsistent here: some exit 1, some exit 0 with empty output). Detected bot → `watch: on` by default; otherwise self-review, no watch.
- **Notifier**: notifier MCPs by capability signature; otherwise chat.
- **Validation**: `package.json` scripts — root and per workspace (monorepo signals: `workspaces` field, `pnpm-workspace.yaml`, `turbo.json`; workspaces declared but empty → record root commands and note it). `Makefile`; commands declared in `CLAUDE.md`/`AGENTS.md`. **PR size budget**: grep guideline files (`CLAUDE.md`, `GUIDELINES.md`, `CONTRIBUTING.md`) for a declared max-PR-size rule; **not found → this is always asked in step 2** (recommended option: "500 changed production lines") — never silently omitted.
- **Labels**: `gh label list` (or tracker equivalent); scan `.github/workflows/*.yml` for jobs that fail on missing labels — those labels become the `required` set in `labels.md`.
- **Observability**: dependencies and config files (`newrelic`, `datadog`, `@sentry/*`, `prom-client`, OpenTelemetry SDKs, `winston`/`pino`); dashboards-as-code in `infra/`; guideline files. Not detected → leave for lazy resolution (create-tasks asks the first time a card needs it).
- **Guardrails (Layer 2)**: guideline files (`CLAUDE.md`, `AGENTS.md`, `GUIDELINES.md`, `CONTRIBUTING.md`) for stated conventions; generated-code markers ("do not edit" headers, codegen output dirs) → propose `protected` entries.
- **Language**: the language the user has been writing in this session — becomes the recommended answer for the conversation-language question in step 2; **never silently assumed into config**.

If `docs/agents/` already exists, load it and treat this run as a review — a three-way reconcile: keep user-edited values unless they name a resource that no longer exists; show removals and additions as one diff; confirm before deleting any key. The `## Agent skills` section update in step 4 follows the same never-overwrite-silently rule.

### 2 — Propose and ask (one batched round; zero only when existing config already answers everything)

Present one summary of detected values. If every open choice resolved by detection or pre-existing config, **skip the ask entirely**. Otherwise, a **single** `AskUserQuestion` (up to 4 questions) covering only the genuinely open choices, detected option first marked "(Recommended)". Typical open choices:

- Tracker when several are viable (e.g. Linear MCP connected *and* GitHub remote): which platform owns the cards?
- GitHub/GitLab with no tracker MCP: GitHub Issues (recommended) or local Markdown?
- Notifier target when a notifier exists (which channel / DM?).
- **PR size budget when no guideline declares one** — free numeric choice: offer "500 changed production lines (Recommended)" as the anchor and accept whatever number the team wants (no allowed range — the value is the team's call). Always asked when not detected.
- **Conversation language — always asked when not already configured**: which language should the pipeline use to talk to you? Recommended option = the language the user is writing in. Skill files are English; the conversation doesn't have to be — the answer goes to `docs/agents/language.md` so every skill in every future session opens in the right language.

### 3 — Write config

Write `docs/agents/` in the project (create the directory if missing). Short prose header + a fenced block of values per file — human-readable, PR-reviewable. Templates:

`tracker.md`
```
platform: github-issues        # linear | jira | notion | github-issues | gitlab | markdown | ...
scope: acme/acme-api           # workspace/project/team — or the cards directory for markdown
product_docs: docs/product/
base_branch: main
language: user                 # artifact language: user (default) | en | pt-BR | ... — for teams whose cards must be readable by everyone
# Mode A (tracker MCP) only — map lifecycle states to the platform's real state names:
# states: { todo: "Backlog", in-progress: "In Progress", in-review: "In Review", done: "Done" }
```

`labels.md` — write the **complete** role map from `/home/digitalscale/.ship-it/shared/pr-flow.md` § Labels (all state, category and `chaos:*` roles — omitting rows breaks the "never ask again" promise later), mapping each role to this repo's actual labels; default role = label name. Include the `required:` set detected in step 1. Pure Markdown tracker with no remote → labels have no platform to live on; write the file as an explicit `n/a (markdown mode — frontmatter labels are free-form)` instead of a map nobody consumes.

`reviewer.md`
```
reviewer: self-review          # <bot login> | self-review | human-only
watch: off                     # on = do-task chains into $watch-pr after opening the PR
escalation: none               # team/handle to request review from when a PR ships over budget (e.g. org/tech-leads)
```

`notifier.md`
```
channel: chat                  # chat | slack | discord | teams | email
target: none                   # channel/DM id when not chat — personal ids go to user memory, never here
```

`language.md`
```
conversation: pt-BR            # language every skill uses to talk to the invoking user — asked by groundwork, never silently assumed. Artifact language (cards/PR comments) lives in tracker.md
```

`validation.md`
```
lint: npm run lint
typecheck: npm run typecheck
test: npm run test
pr_size_budget: 500            # max changed production lines per PR (tests/fixtures/generated excluded)
guidelines: AGENTS.md          # files every implementation must read first (groundwork step 4 guarantees it exists)
```

`observability.md` (write when detected; otherwise create-tasks resolves it lazily — full chain in workflow-context § Observability)
```
platform: none                 # newrelic | datadog | grafana | sentry | cloudwatch | otel | none
logger: console                # detected logger — or pino (Node default suggestion) — or console if the user declined
conventions: none              # event naming, dashboards-as-code location, alert policy dir
```

`guardrails.md` (optional — write only when the project has rules beyond the universal invariants in `/home/digitalscale/.ship-it/shared/guardrails.md`)
```
protected: []                  # extra paths skills must never edit (generated code, vendored dirs)
forbidden: []                  # extra operations beyond the universal invariants
notes: none
```

Personal facts the user gave you (their Slack member ID, DM preferences) go to **user memory**, never into the repo.

### 4 — Wire it into every session (every agent)

Write the `## Agent skills` section into the project's **`AGENTS.md`** (the cross-agent standard — opencode, Codex, Gemini CLI, Cursor and others auto-read it) **and** into **`CLAUDE.md`** (what Claude Code auto-loads). Same stanza in both, created when missing, kept in sync on reruns — and never rewrite anything else in either file:

```markdown
## Agent skills

This project is configured for the ship-it pipeline.
Role config lives in docs/agents/ (tracker, labels, reviewer, notifier, validation).
Skills must read it instead of asking. Learned project rules are written back there.
Conversation language: pt-BR (source of truth: docs/agents/language.md).
```

This is what makes the config load in every future session — the write-back loop's entry point. The conversation-language line is a deliberate exception to "index only, no values inline": `CLAUDE.md`/`AGENTS.md` are auto-loaded at session start, so mirroring the language there means the very first reply is already in the right language — before any skill loads config. `docs/agents/language.md` stays the source of truth; on reruns the stanza line is regenerated from it.

### 5 — Handoff

Report: each role → resolved value → source (config — pre-existing / detected / asked / default), files written, and the pipeline order (`$create-product` → `$create-tasks` → `$do-task` → `$chaos-engineering`). If the notifier resolved to `chat`, add the fleet warning: unattended/automode runs that park will notify nobody — configure a real notifier before running fleets (autonomy.md). If the user wanted a platform whose MCP isn't connected, give the registration instructions for their environment and remind them a session restart is required — config already written survives the restart.

## Guardrails (this skill, on top of shared/guardrails.md)

- Never create labels, projects or channels on any platform — groundwork only maps what exists.
- Never store tokens/secrets in `docs/agents/` — connection auth belongs to MCP/CLI config.
- `CLAUDE.md`/`AGENTS.md` edits are append/update of the `## Agent skills` section only; never rewrite the rest.
