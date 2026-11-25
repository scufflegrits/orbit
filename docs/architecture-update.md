# Orbit architecture update prompt

Copy the prompt below and append the change, diff, or branch to review.

```text
Update docs/architecture.md to reflect the Orbit change described below. Work from
the repository root. Read the architecture and the Mermaid guide at
/home/sysadmin/projects/guides/mermaid/mermaid-best-practices-r1.1.0.md before
editing. If the guide is unavailable, follow the conventions in this prompt and
mention the missing guide in your summary.

1. Identify which architectural claims the change affects. Trace them to the
   current implementation and relevant tests. Check the entry point, ownership,
   source precedence, persistence, and failure paths where relevant. Use source
   files, build scripts, and release instructions to confirm what runs and what
   ships. Use repository-relative links to the relevant evidence in the document.
   If the change has no architectural impact, leave the document untouched and
   explain why.

2. Update the affected prose and embedded Mermaid blocks together. Check related
   sections for stale claims. The planned views cover runtime and integrations,
   source layers and build, the map and workspace model, startup and map selection,
   and saving a map edit. Keep the Interaction state placeholder until the task
   explicitly calls for completing it. When it does, use src/ui/modes.js and its
   tests to verify the concurrent state regions, Escape precedence, and drag
   cancellation. Keep this documentation update scoped to docs/architecture.md.

3. Follow the Mermaid guide when editing a block. Put self-contained YAML front
   matter first, indent with two spaces, and quote hex theme colors. Preserve
   descriptive IDs when the underlying concepts are unchanged. Use named classes
   and descriptive IDs for styled flowchart edges. Check each relationship, arrow
   direction, fallback, and failure branch against the implementation and the
   surrounding prose. For a flowchart wrapper, match its direction to the parent.

4. Render every changed block to SVG and PNG with mmdc and keep the review files
   outside the repository. Treat printed errors as failures even if the CLI exits
   successfully. For diagrams with a layout setting, render both ELK and dagre and
   record the chosen layout and reason in the block's front matter. Check styles
   in the SVG and inspect each PNG for wrapping, containment, arrowheads, and
   contrast on light and dark page backgrounds. Check the intended Markdown viewer
   if available. If rendering is unavailable, run Mermaid's parser if possible
   and report the limits of that check.

5. Review the final diff for accuracy and scope. Summarize what changed, which
   blocks were checked, the renderer and Mermaid versions used, and any checks
   that remain unverified.

Orbit change to review:
[Describe the change or provide a diff or branch reference.]
```
