# Task card template (REWRITE_PLAN.md, "Task card")

Kept outside `.claude/agents/` so it is never read as an agent definition. The Lead copies it for each card, fills it in, and sends it as the worker's prompt.

```
Task:        <checkbox text>  (Phase N)
Goal:        one sentence on what must be true when done
Base:        rewrite @ <sha> (the card's tests are already committed here)
Worktree:    <absolute path>. Use absolute paths inside it for every tool call;
             Grep and Glob need an explicit path. Anything else is refused.
Read first:  files and plan sections
May change:  exact paths
Must not change: tests/** (unless listed above), the shared files, anything else
Interface:   the exports the module must have, with JSDoc signatures
Permissions: .claude/cards/<card>.json in the main checkout, written by the Lead
Setup:       done by the Lead: node_modules linked, the card registered
Done when:   these commands pass when the Lead runs them (you have no Bash):
             <commands, with expected time>
Hard rules:  your agent file's list
Report back: in the format below
```

## Report back

```
Status:     done | blocked | partly done
Base:       the sha the worktree started from
Changed:    files, with one line each on what changed
Last run:   the latest command output the Lead sent, and whether you expect the next run to pass
Deviations: anything that differs from the card, and why
Questions:  anything the Lead must decide
```
