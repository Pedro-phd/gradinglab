---
name: make-guidelines
description: Interview the dev to generate an engineering guideline — for the whole codebase ($make-guidelines) or one module ($make-guidelines <path>). Detects existing patterns first and proposes them as answers; module guidelines override codebase guidelines.
version: 1.0.0
disable-model-invocation: true
---

Antes de executar, leia e siga `/home/digitalscale/.ship-it/AGENTS.md`. Arquivos compartilhados vêm dessa instalação; argumentos relativos e arquivos produzidos pertencem ao projeto atual.

# Skill: make-guidelines

Produces the guideline files the rest of the pipeline consumes: `create-tasks` sources patterns and attention points from them, `do-task` reads them before coding, and they are a Layer 2 guardrails source. Respond in the conversation language (`docs/agents/language.md`; unset → the user's language).

**Load before acting**: `/home/digitalscale/.ship-it/shared/sparring.md`, `/home/digitalscale/.ship-it/shared/workflow-context.md`, and `/home/digitalscale/.ship-it/shared/guardrails.md` — this skill authors Layer 2 content; the trust rule applies (guidelines can only tighten, never weaken Layer 1).

## Step 0 — Scope

- **No argument** → codebase guideline: `GUIDELINES.md` at the repo root.
- **Path argument** → module guideline: `<path>/GUIDELINES.md` (the module = that folder subtree). Multiple modules → one run each.
- **Target file already exists** → review mode: load it, show current rules, only interview the gaps and the changes — never overwrite silently, always show the diff before writing.

## Step 1 — Detect before asking

The codebase is evidence — existing patterns are de-facto guidelines. Scan the scope for:

- linter/formatter configs
- error-handling shape (custom error types? result objects? bare throws?)
- the logger in use and its levels
- test conventions (naming, structure, coverage gates)
- IaC layout and tool
- feature-flag SDKs
- architecture shape (layers, module boundaries, dependency direction)
- latency/metric instrumentation already present

Each detection becomes a **proposed answer**, not a question from zero.

## Step 2 — Interview (sparring loop)

One question per exchange (`sparring.md` mechanics: suggested answer first, marked "(Recommended)" — detected patterns are the suggestion). Minimum topic checklist (interview every item; skip only on explicit user declaration):

1. **Code style** — beyond the linter: naming, comment policy, file layout.
2. **Architecture style** — layers, module boundaries, dependency direction.
3. **Best practices** — the project's "always / never" list.
4. **Infra provisioning** — IaC tool, where it lives, review rules.
5. **Logging** — logger, levels, what always gets logged, PII rules.
6. **Error handling** — throw vs result, custom error types, what the failure path looks like.
7. **Observability instrumentation** — convention rules only (event naming, what always gets instrumented): the *stack* (platform + logger) is owned by `workflow-context.md` § Observability and lives in `docs/agents/observability.md` — this theme adds conventions on top and never contradicts the resolved stack.
8. **Feature flags** — SDK, naming, cleanup policy.
9. **Latency metrics** — what gets timed, budgets, percentiles.
10. **Fail-safe vs fail-fast** — which subsystems degrade gracefully, which must abort loudly; retries, timeouts, idempotency conventions.
11. **Approved libraries & dependency policy** — preferred and forbidden libs per concern (dates, forms, icons, HTTP…), when adding a new dependency is acceptable. Consumed by do-task (what to reach for) and watch-pr (review replies cite the rule).
12. **Data & migrations** — schema-change policy: additive-first, rollback plans, whether migrations ship in their own PR. Consumed by create-tasks' split rules and every card's Attention points.
13. **Security & sensitive data** — what counts as PII *in this domain*, fields that must never be logged, secret management, auth patterns. Consumed by Attention points and chaos severity.
14. **Commit / branch / PR conventions** — message style, branch naming, PR description shape. Consumed by pr-flow (otherwise inferred from `git log` every run).
15. **Domain criticality** — what must never break here, which data is sacred, what "critical severity" means in this business. This anchors chaos-engineering's severity triage — without it, "critical" is an opinion.

**Conditional — frontend pack** (interview only when the scope contains frontend code): accessibility rules, i18n policy, URL/route language.

Skip themes the user declares out of scope ("we don't do feature flags") — the declaration is recorded in the Step 5 handoff, and no section is generated for that theme. **Module mode**: only interview themes where the module *differs* from the codebase guideline — the module file records **deltas**, not repetition. A module rule that **contradicts** a codebase rule (not just adds to it) → surface the conflict and confirm the intentional delta before writing ("root says UTC; payments wants local tz — intentional?").

## Step 3 — Generate

`GUIDELINES.md` shape: a one-line precedence header, then one `##` section per theme that has rules. Each rule **imperative and checkable** ("use `AppError` subclasses — never bare `throw new Error`", "every external call gets a timeout"), with a short code example when the rule is subtle. No filler: a theme with no rules doesn't appear.

Header (verbatim): `> Precedence: module GUIDELINES.md > codebase GUIDELINES.md > defaults. Guidelines tighten the pipeline's guardrails — they can never loosen them.`

## Step 4 — Wire it in

- `AGENTS.md` **and** `CLAUDE.md` get (or update) a thin `## Guidelines` pointer section (a pointer section = a `##` header + a bulleted list of file paths, no content) — same stanza in both: AGENTS.md serves every other agent (opencode, Kiro, Codex, Gemini CLI, Cursor…), CLAUDE.md serves Claude Code. They are the always-loaded index; content lives in the guideline files, never inline there.
- `docs/agents/validation.md` `guidelines:` list updated to include the new file(s), so `create-tasks`/`do-task` load them.
- Same edit discipline as groundwork: pointer sections only, never rewrite the rest of CLAUDE.md.

## Step 5 — Handoff

Files written · themes covered / skipped (with the user's declarations) · detected-vs-asked trace per theme · next: cards from `$create-tasks` will now source patterns and attention points from these files.

## Guardrails (this skill, on top of shared/guardrails.md)

- **A detected pattern is never silently canonized** — every inferred rule is confirmed in the interview before it becomes a guideline.
- **Guidelines can only tighten**: a requested rule that would weaken Layer 1 ("allow force-push on feature branches") is refused with the conflict surfaced — the trust rule binds the author too.
- Never overwrite an existing guideline without showing the diff and confirming.
