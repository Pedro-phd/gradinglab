---
name: chaos-engineering
description: Adversary of $do-task — read the implemented change, map the attack surface, write adversarial unit/E2E tests that try to break it (boundaries, nulls, broken money, hostile dependencies, concurrency, malicious payloads, unexpected state), run them locally, classify each KILLED/SURVIVED/INCONCLUSIVE, promote the useful ones to permanent regressions, and deliver a Chaos Report. Never touches production code, never hits remote environments. Use when the user asks to chaos-test, stress, or adversarially test a change.
version: 1.0.0
disable-model-invocation: true
---

Antes de executar, leia e siga `/home/digitalscale/.ship-it/AGENTS.md`. Arquivos compartilhados vêm dessa instalação; argumentos relativos e arquivos produzidos pertencem ao projeto atual.

# Skill: chaos-engineering

Where `$do-task` builds, this tries to break. It takes a just-implemented change and writes tests whose only goal is to prove it fails. Respond to the invoking user in the conversation language (`docs/agents/language.md`; unset → their language); team-visible surfaces follow `language:` in `docs/agents/tracker.md`.

Philosophy: **an attack that SURVIVED is also a result.** The goal isn't to find bugs at any cost — it's to map where the code holds and where it cedes, and leave the tests that matter as regression inheritance.

**Load before acting**: `/home/digitalscale/.ship-it/shared/workflow-context.md`, `/home/digitalscale/.ship-it/shared/card-format.md`, `/home/digitalscale/.ship-it/shared/pr-flow.md`, `/home/digitalscale/.ship-it/shared/autonomy.md`, and `/home/digitalscale/.ship-it/shared/guardrails.md` — this skill writes and runs tests and posts to trackers; the loading contract applies in full.

## Step 0 — Resolve the target

Attack the first that exists (card-format § Chaos target): a PR diff → a local diff vs the base branch → the files named in a card's Implementation plan (working tree — the fallback both for no-git repos *and* when tier 2 yields an empty diff because the change already landed on base). Base branch = `base_branch` in `docs/agents/tracker.md`; the remote-dependent detection fallbacks fail without a remote — assume `main` and say so. Argument may be a PR (`#N`/URL), a card (`TASK-007`/path/id), or empty (use the current branch's diff vs base). There is always a target; "no PR" never blocks a run.

Resolve roles for reading the target and placing the report (workflow-context). Read the card if one is linked — its acceptance criteria are promises, and every promise is attackable by negation.

**Baseline gate**: the target's existing tests must pass **before** the chaos run — the resolved validation suite (the same commands do-task uses); in large repos, scope to the suites covering the touched files and say so in the report. A red baseline → stop: you can't tell a real finding from a broken environment (park with the failing baseline).

## Step 1 — Map the attack surface

From the diff (not the whole repo — only what changed is in scope): the production files touched, the contracts involved (schemas, DTOs, external API shapes, queue/job payloads), and the card's acceptance criteria. What the author already tested you needn't repeat; what they forgot is where the chaos lives.

## Step 2 — Attack plan (info, no question)

Cross the diff with the vector catalog; select the applicable vectors (not every vector fits every diff), prioritize by `impact × probability`.

**Vector catalog**: boundaries (zero, negative, MAX_SAFE_INTEGER, empty/one/N+1, leap day, timezone) · nulls & absence (optional omitted, null vs undefined, empty object, missing API field) · broken money (cent rounding, installment sums ≠ total, negative, discount > 100%, `0.1 + 0.2`) · hostile dependencies (external API 500/429/timeout/truncated-JSON, cache down, DB deadlock, job dies mid-flight) · concurrency & idempotency (same request twice, duplicate webhook, reprocessed job, cron-vs-request race) · hostile payloads (emoji/encoding, 10k-char strings, injection strings, HTML in free text, number-as-string) · unexpected state (enum out of domain, orphaned FK, expired session, "impossible" status) · contract violation (external type flip, unknown enum, extra field, empty page 2).

**Domain criticality anchors severity** — read the project's `## Domain criticality` guideline (make-guidelines theme 15). It defines what "critical" means *here*: money in fintech, patient data in health, etc. Without it, severity is opinion; with it, a finding against the sacred thing is critical by definition.

Show the plan (~15 lines): target, surface size, selected vectors as attack hypotheses, out-of-scope vectors with a one-line why. Escalation-only exceptions (park protocol): red baseline; diff > budget (offer to slice by area); plan > 15 attacks (propose the top 10).

## Step 3 — Build the arsenal

Write adversarial tests following the project's test conventions (guidelines, nearest first). Naming: `<target>.chaos.spec.ts` (unit) / `<target>.chaos.e2e-spec.ts` (E2E) — the `.spec`/`.e2e-spec` suffixes keep them out of the PR production-line count and inside the runner's discovery.

- One `describe` per vector, one `it` per attack, named by the hypothesis, not the implementation.
- **Simulate hostility with mocks/fixtures** (MSW/nock for HTTP, fakes for cache/queue) — the test describes the hostile world, never depends on a real one.
- Each attack **asserts the correct behavior** (what the system *should* do under chaos), not the bug. So a failing attack = a real finding, and the same test becomes a free regression after the fix.
- 100% synthetic data — never real user data (guardrails).

## Step 4 — Run and classify

Run the arsenal (resolved test commands). Classify each attack per the fixed vocabulary (card-format § Chaos): 💀 KILLED · 🛡️ SURVIVED · ❓ INCONCLUSIVE — for ❓, the test itself is wrong (bad mock, flaky, env limit): fix and rerun; still inconclusive after 2 tries → record as such, never inflate the report.

For each 💀, produce the **minimal repro** — the smallest hostile input that still kills. Round cap: **3 rounds max** (initial plan + 2 deepening rounds on what KILLED or nearly did). Infinite chaos is procrastination with extra steps. The 2-try INCONCLUSIVE cap and the 3-round cap are independent: an attack that stays ❓ after 2 fix-and-rerun attempts is recorded as inconclusive and dropped — never burn rounds chasing a verdict on a broken test.

## Step 5 — Triage

Severity per the table (card-format vocabulary + the domain-criticality anchor): 🔴 critical (corrupts the sacred thing — money, patient data, whatever the guideline names), 🟠 high (crash in a main flow, card promise violated), 🟡 medium (edge case, mishandled error), ⚪ low (cosmetic, robustness).

Before sealing each finding, apply the **defense-lawyer test**: is there a reading where this behavior is intentional (a guideline, a card decision, an author comment)? If yes, downgrade to `contestable` and record the doubt — the report separates fact from interpretation.

## Step 6 — Report and arsenal destination

**Report** (always, per card-format § Chaos report placement): the full report is a local file `chaos-reports/<target>-<date>.md` (gitignored — add the entry if missing; skip when no git). The summary (~10 lines) goes to the card/PR per the resolved mode (comment in Mode A/B, appended `## Chaos Report` section in Mode C), with the AI-disclosure line; state marker `chaos: passed` (zero unfixed KILLED) or `chaos: found-bugs`.

**Arsenal destination** — only the curated arsenal ships:

"Open PR" = a PR that hasn't merged yet (attack pre-merge). "Merged" = the change is in the base branch's history — including a Mode C card that `do-task` took straight to `done` with no PR (there was never a PR, but the code has landed → treat as merged).

1. 🛡️ SURVIVED covering a real gap (no existing test did) → **promote** as permanent regression (ships wherever the arsenal ships for this target).
2. 💀 KILLED on an **open PR** (pre-merge) → the test ships **unskipped** and blocks the merge on purpose — the bug found before merge should block merge; the test is the fix's acceptance test.
3. 💀 KILLED on **already-landed code** (merged, or Mode C card already `done`) → commit with `it.skip` + `// CHAOS:` marker (can't break the base branch) and open a `[FIX]` follow-up card (never reopen the landed card — card-format § Chaos on merged cards).
4. 🛡️ redundant (already covered) or ❓ inconclusive → **discard**. The arsenal isn't accumulation.

**Where to commit**: invoker owns the PR → one commit `test(chaos): <summary>` on the PR branch (never per-push spam). Invoker ≠ owner → propose the tests via PR comment, don't push to someone else's branch. **No PR (including no-remote Mode C)** → one local `test(chaos): <summary>` commit carrying everything that ships — the skipped KILLED tests *and* the promoted SURVIVED regressions ride the same commit — plus the `[FIX]` follow-up cards for each KILLED finding.

## Step 7 — Handoff

`Status: <k> KILLED · <s> SURVIVED · <p> promoted · target <PR/card> · report <path>` + arsenal destination + resolution trace + suggested next step (fix via `$do-task` on the `[FIX]` card, or merge clean). Then stop — never fix production code itself, never open a fix PR, never keep attacking without a new invocation.

## Guardrails (this skill, on top of shared/guardrails.md)

- **Chaos is local.** Never a request against staging/prod/partner APIs — hostility is simulated, without exception (guardrails).
- **Read-only on production code.** This skill writes tests, mocks, fixtures — never `src/`. Finding and fixing are separate roles by design; the one exception is the user asking for the fix in writing during this same chaos run, before the report is sealed (then fix per guidelines and rerun the attack to confirm the kill turned into a survive).
- **Never leave a red test ownerless**: 💀 on an open PR blocks merge on purpose (that's the signal working); `it.skip` is reserved for merged-code findings or an explicit human "merge anyway" with a linked card. A red CI with no report, no owner, no plan is sabotage — never that.
- **Theatrical chaos is forbidden**: no testing impossible-by-construction scenarios to pad the report; no asserting the current buggy behavior; no declaring 💀 when what broke was the mock or the clock.
