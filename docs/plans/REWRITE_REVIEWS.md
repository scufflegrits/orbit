# Rewrite plan reviews

The history of reviews of [REWRITE_PLAN.md](REWRITE_PLAN.md), moved out of the plan on 2026-11-20 so the plan holds only what's current. Section names in the "Resolved in" columns refer to the plan as it was at the time; later reviews and decisions may have changed them.

## First review (2026-11-20)

Three read-only subagents reviewed the first version of this plan (commit `94b922d`) on 2026-11-20: architecture, data and testing, and process and delegation. Between them they found 9 blockers. The Lead spot-checked the main claims in the code before revising.

| Blocker | Resolved in |
| --- | --- |
| No way for old and new code to run together | "Coexistence (strangler)" and the per-phase "done when" lines |
| A stricter schema would silently drop users' maps | Differential test against 2.2.0, behavior inventory rules, "Fixture" |
| Data list missing formats and per-workspace scope | "Data the rewrite must keep" |
| Team-marked paths conflicted with the page's combined indices | "Rules the structure enforces": team suns keep their place in the numbering |
| Mode diagram and rules didn't match 2.2.0 | Redrawn "Interaction modes" with file:line references |
| Builders couldn't commit, so there was nothing to merge | "How the Lead runs a card" |
| Parallel builders would collide on the bundle and shared files | Shared files are Lead-only; the Lead rebuilds after each merge |
| Moving the test calls isn't mechanical (Haiku) work | Helpers only list the calls; Builders move one file per card, one at a time |
| The private fixture and the inherited permissions | Hard rules, grep excludes, milestone 18 Lead-only, deny rules or a hook |

## Second review (2026-11-20)

An outside review of commit `1d3bb81` judged the plan ready for preparation but not yet an unambiguous implementation contract. It raised six points. It also noted that its assessment didn't check the plan's behavioral claims against the code.

| Point | Resolved in |
| --- | --- |
| Test builds versus release builds | "Builds and what tests run": a separate test bundle in fixture copies; the committed release bundle checked for match, for no hook, and by `release_smoke.py` |
| Who owns interaction-mode state during the migration | "Who owns mode state during the migration" and the new phase 4b cut-over: one owner at a time, old flags deleted |
| Reset bug versus "preserve 2.2.0" | Already decided and fixed in 2.2.1 (`1d3bb81`). The baseline is now stated as 2.2.1 in "How we test" and phase 0 |
| Blanket permission blocks conflict with authorized cards | Per-card permissions enforced by a guard on the worker agents; what the guard can't see is named; checks of the real setup in phase 0 (tightened by the third review) |
| The pop-up check overstated what it proves | Three layers: a synchronous-call unit test, the activation check as supporting evidence only, and a visible-window Edge check as the actual proof |
| No measurement recipe for performance | "Performance recipe": fixed map and seed, browser, alternating order, warm-up, 20 runs, medians, a 5 ms floor, one rerun |
| Too much ceremony for small changes | "Right-sizing the process": small changes skip cards, worktrees, and review; Edge, docs, and push once per phase |

## Third review (2026-11-20)

The same reviewer, on commit `a13c224`, found most earlier concerns resolved and raised four more:

| Point | Resolved in |
| --- | --- |
| The permission guard failed open when a worker had no card, ignored read tools, and fell back to review | "Enforcement": workers identified by agent, not by directory; cards in a registry in the main checkout; no card means no access; Read, Grep, and Glob limited to the worktree; Bash on an allowlist (later removed entirely, see the fourth review); no fallback to review alone, and delegation is off if phase 0 can't confirm this |
| The Quick find measurement could wait forever when results don't change | "Performance recipe": the end is input handling plus one animation frame, whatever the results; a 2-second timeout per key; the five queries committed with the map |
| Test-bundle freshness checked only `src/` timestamps | "Builds and what tests run": rebuild before every browser run, plus a SHA-256 fingerprint of all build inputs checked by `write_fixture`; no timestamps |
| Phase 4b treated controllers as mode flags | Phase 4b step 2: a table separating state from controllers; `palette` and `variableDialog` stay as controllers; the one-owner check targets their use as true-or-false tests only |

## Fourth review (2026-11-20)

The same reviewer, on commit `0feb609`, judged the approach ready for phase 0 and raised one substantive point and two small ones:

| Point | Resolved in |
| --- | --- |
| An allowed command can run worker-written code, which the guard can't inspect | "Execution boundary". The plan first offered a sandbox, with no Bash for workers as the alternative. The user chose no sandbox, so workers have no Bash, and the Lead reads each diff before running any worker-written code |
| Task-card setup used commands the worker couldn't run | "The Lead prepares each worktree before launch"; artifacts default to the worktree's `.artifacts/` folder, so no environment variables |
| The performance endpoint was described as rendering | "Performance recipe": the endpoint is the next animation-frame callback after input handling, which runs before painting |

## Lead's own review (2026-11-20)

Asked whether the Lead would change anything, after the fourth review. Four changes, all applied with the user's approval:

| Change | Where in the plan |
| --- | --- |
| Delegation becomes a trial on two or three phase 2 core modules; the guard and agent files are built only if the trial starts | "Who does the work" and "Delegation trial" |
| Go/no-go checkpoints after phase 2 and after phase 4b | "Checkpoint A" and "Checkpoint B" in "Plan" |
| The review history moves to this file; after phase 0 the plan is frozen except for ticks, recorded decisions, and corrections | "Branch rules" |
| Performance baseline measured in phase 0, with a quick check at each phase end | "Performance recipe" and phase 0 |
