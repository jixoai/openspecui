## User Input

<user>我重新打开来#140 ，作者提出了一些BUG。请你检查一下，先和我讨论，撰写openspec changes。
注意目前工作目录还有在做翻译相关的工作，不冲突。</user>

GitHub issue #140 was reopened after the previous fix. Reporter `jimisola` added:

- "It seems as if if the specs for changes (picture #2 below) does not apply the hook."
- Reported surfaces:
  - specs: ok
  - changes/spec: not rendered
  - changes/tasks: ok
  - archive/delta-spec: ok
- Follow-up: "Please check changes/tasks as well. It's flaky on my end and I'm not sure why."

## Objective Scope

- Investigate the reopened #140 report as a hook-processing and document-rendering consistency bug.
- Keep this loop independent from the active translation work in `refine-document-translation-heading-projection`.
- Define the expected platform law for OpenSpec document views that render Markdown documents affected by `onReadDocument`.
- Prepare an implementation-ready OpenSpec change, but do not start implementation until the manager confirms the architecture direction.
- Cover active change delta specs and tasks, and include archived delta specs/tasks as regression boundaries because the reporter compared those surfaces.

## Non-Goals

- Do not modify the active translation change or translation implementation in this loop.
- Do not add a new hook API for this bug unless current evidence proves `onReadDocument` cannot express the requirement.
- Do not patch one page with a local `if change/spec` special case.
- Do not change source-mode file editors; source reads must remain audit-safe and unprocessed.
- Do not reopen the already-completed #139 parser concern unless reproduction shows parser data still destroys the Markdown before rendering.

## Acceptance Boundary

- Active change artifact views render `openspec/changes/<id>/specs/<spec>/spec.md` through the same hook-processed Markdown path as main specs.
- Active change artifact views render `openspec/changes/<id>/tasks.md` through the same hook-processed Markdown path without flaky divergence between artifact preview and folder/source views.
- Archived change delta specs and tasks keep their current hook-processed rendering behavior and gain regression coverage where practical.
- Source/audit editor views can still display unprocessed file content intentionally.
- The implementation plan identifies the exact view/data paths that should consume processed Markdown and the paths that should stay source-only.
