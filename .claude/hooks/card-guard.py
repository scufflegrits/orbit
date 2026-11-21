#!/usr/bin/env python3
"""Guard for Orbit's worker subagents (REWRITE_PLAN.md, "Enforcement").

Attached as a PreToolUse hook in the worker agents' own definitions
(.claude/agents/orbit-*.md), so it runs for every tool call a worker makes and
never for the Lead's. It fails closed: any problem (no card, two cards, bad
input, an exception) denies the call.

The card registry is .claude/cards/*.json in the main checkout (git-ignored),
written by the Lead before launching a worker. During the trial exactly one
card may be registered; the guard uses it whatever the call's working
directory is.

    {"card": "2-search", "worktree": "/abs/path", "mayChange": ["src/core/search.js"],
     "mayChangeTests": [], "buildOutputs": ["orbit.js", "orbit.test.js"]}

Rules for a worker:
- Read, Grep, Glob: every path (and the search root) must be inside the card's worktree.
- Edit, Write: the path must be listed in mayChange or mayChangeTests.
- Every other tool (Bash, Agent, web, ...): denied.
Private files are never reachable: they don't exist in a worktree, and any
path naming them is refused outright.

Exit code 2 blocks the call and shows the reason to the worker.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

PRIVATE = ("rdptest01.rdp", "request-observations.md")
READ_TOOLS = {"Read": ("file_path",), "Grep": ("path",), "Glob": ("path",)}
EDIT_TOOLS = {"Edit": "file_path", "Write": "file_path"}


def main_checkout():
    """The main checkout, found from git's shared directory, so it's right from any worktree."""
    here = Path(__file__).resolve().parent
    common = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd=here,
                            capture_output=True, text=True, check=True).stdout.strip()
    return Path(common).parent


def log(root, line):
    try:
        with open(root / ".claude" / "cards" / "guard.log", "a") as out:
            out.write(time.strftime("%H:%M:%S ") + line + "\n")
    except OSError:
        pass


def deny(root, reason, call):
    if root:
        log(root, f"DENY {call}: {reason}")
    print(f"Blocked by the Orbit card guard: {reason}", file=sys.stderr)
    sys.exit(2)


def inside(path, folder):
    resolved = Path(os.path.realpath(path))
    return resolved == folder or folder in resolved.parents


def check(root, event):
    tool = event.get("tool_name", "")
    args = event.get("tool_input") or {}
    call = f"{event.get('agent_type', '?')}/{event.get('agent_id', '?')} {tool} {json.dumps(args)[:200]}"
    cards = sorted((root / ".claude" / "cards").glob("*.json"))
    if len(cards) != 1:
        deny(root, f"expected exactly one registered card, found {len(cards)}", call)
    card = json.loads(cards[0].read_text())
    worktree = Path(os.path.realpath(card["worktree"]))
    if worktree == Path(os.path.realpath(root)) or not (worktree / ".git").exists():
        deny(root, "the card's worktree must be a separate git worktree", call)
    text = json.dumps(args)
    if any(name in text for name in PRIVATE):
        deny(root, "private files are off limits", call)
    cwd = event.get("cwd") or str(worktree)

    def absolute(value):
        return value if os.path.isabs(value) else os.path.join(cwd, value)

    if tool in READ_TOOLS:
        for field in READ_TOOLS[tool]:
            value = args.get(field) or (cwd if field == "path" else None)
            if not value:
                deny(root, f"{tool} needs {field}", call)
            if not inside(absolute(value), worktree):
                deny(root, f"{value} is outside the card's worktree {worktree}", call)
        if tool == "Glob" and ".." in str(args.get("pattern", "")):
            deny(root, "glob patterns may not climb out of the worktree", call)
    elif tool in EDIT_TOOLS:
        value = args.get(EDIT_TOOLS[tool])
        if not value or not inside(absolute(value), worktree):
            deny(root, f"{value} is outside the card's worktree {worktree}", call)
        relative = Path(os.path.realpath(absolute(value))).relative_to(worktree).as_posix()
        allowed = set(card.get("mayChange", [])) | set(card.get("mayChangeTests", []))
        if relative not in allowed:
            deny(root, f"{relative} is not in this card's May change list", call)
    else:
        deny(root, f"workers may not use {tool}", call)
    log(root, f"ALLOW {call}")


def main():
    root = None
    try:
        root = main_checkout()
        event = json.loads(sys.stdin.read())
        check(root, event)
    except SystemExit:
        raise
    except Exception as error:  # Fail closed on anything unexpected.
        deny(root, f"guard error ({type(error).__name__}: {error})", "?")


if __name__ == "__main__":
    main()
