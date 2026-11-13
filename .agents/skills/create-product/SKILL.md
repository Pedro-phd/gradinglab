---
name: create-product
description: Turn an idea, a conversation, or loose notes into a product document ready for $create-tasks — no PM required. Runs a sparring interview to fill the gaps, synthesizes the document, and publishes it where the project tracks work.
version: 1.1.0
disable-model-invocation: true
---

Antes de executar, leia e siga `/home/digitalscale/.ship-it/AGENTS.md`. Arquivos compartilhados vêm dessa instalação; argumentos relativos e arquivos produzidos pertencem ao projeto atual.

# Skill: create-product

Entry point of the pipeline. Anyone — founder, dev, designer, PM, whoever — brings raw material and leaves with a product document that `$create-tasks` can split into technical cards. The pipeline makes no assumption about who writes product scope or where: the document is produced by interview, not by role. Respond in the conversation language (`docs/agents/language.md`; unset → the user's language).

**Load before acting**: `/home/digitalscale/.ship-it/shared/workflow-context.md`, `/home/digitalscale/.ship-it/shared/sparring.md`, and `/home/digitalscale/.ship-it/shared/guardrails.md` — this skill writes product docs and may publish tracker items; the loading contract applies.

Accepted input: free text in the argument, a path to a rough doc, "this conversation", or nothing at all (start from zero).

## Process

### 1 — Gather context and resolve roles

Collect the raw material: the argument, the referenced file, or the current conversation. If a repo is connected, read related docs and code **before** asking anything. List what the material already answers — those questions are skipped.

Resolve the **Tracker** role now, per `/home/digitalscale/.ship-it/shared/workflow-context.md` (batched question if unresolved) — config questions happen **before** the sparring session starts, never in the middle of it.

### 2 — Sparring session

Run `/home/digitalscale/.ship-it/shared/sparring.md` over the idea. Minimum topic checklist: the problem, who it's for, measurable success criteria, scope in/out, constraints, and the riskiest assumption. Depth is proportional to ambiguity — a well-written draft might need 3 questions; a one-liner might need 20. Stop when the sparring completion criteria hold: you could sketch the solution and a QA could write a test plan without guessing.

### 3 — Synthesize the document

Fixed template. Section headers are fixed English tokens (stable for `$create-tasks` to parse); the content inside them is written in the user's language. Product-level only — technical detail (files, tests, stacks) belongs to `$create-tasks`:

```markdown
# <Product / feature name>

## Problem            — what hurts today, for whom, evidence if any
## Who it's for       — the concrete user/persona
## Success criteria   — measurable; how we know it worked
## Scope
### In
### Out               — explicit non-goals
## Acceptance criteria — high-level, verifiable (Gherkin-ish, no implementation detail)
## Constraints & dependencies
## Open questions      — table: question · owner · status
```

- **Owner** in Open questions = the role or person who must decide this before implementation (e.g. "tech lead — stack choice", not "TBD").
- Never fabricate an answer the user didn't give — unresolved topics go to **Open questions**, visibly.

### 4 — Publish

- Write the document to `docs/product/<slug>.md` in the project directory (works with or without git; create the folders if missing). One product doc per feature/product — no `PRODUCT.md` at root; that name is only honored as a legacy input by `$create-tasks`.
- **Tracker MCP / GitHub Issues mode**: additionally offer to publish a product item linking the doc, so the scope is visible where the team tracks work.
- Never overwrite an existing product doc silently — show what would change and confirm.
- Fold everything the user must approve — overwrite (if any), tracker publish, and any pending config write-back — into **one** final confirmation, not a chain of prompts.

### 5 — Handoff

Return the doc path (and item URL if published) plus the next step: `$create-tasks <path-or-url>`.

## Guardrails (this skill, on top of shared/guardrails.md)

- Product document ≠ technical card: no `file:line`, no `describe/it`, no stack decisions here.
- Sparring answers are the user's decisions — record them faithfully; disagree during the interview, not in the document.
- AI-disclosure on anything published to a tracker — rule owned by `/home/digitalscale/.ship-it/shared/guardrails.md`.
