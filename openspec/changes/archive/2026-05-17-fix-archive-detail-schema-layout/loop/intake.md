## User Input

<user>接着修复一个问题，我们的archiveDetail始终是：“Archived change not found:”。BDD驱动开发，确保以后类似的事情不再发生，然后再收尾提交代码。</user>

<user>我看到你这个代码，我觉得你的设计有点过度耦合 官方Schema(spec-driven)。而OPSX是允许自定义Schema的。

好好检查一下，还有什么地方存在对官方Schema过度耦合的行为？整理后给出你的解决方案</user>

<user>1. 不考虑向下兼容
2. 撰写这份破坏性变更的openspec changes文件
3. 进行全面可靠的工具类工具函数的封装，确保全局统一
4. 封装要有足够的容错率。因为有些Schema可能会升级，导致旧版的change会和新版的Schema失去绑定。这个时候仍然要有足够的容错能力，客观地展示信息。因为我们本身是一个信息公示平台，结构化的目的只是为了让我们更好地关联数据、展示数据。而不是为了用强类型去限制自身，这是本末倒置的。</user>

## Objective Scope

- Replace archive detail's legacy `Change` contract with a schema-neutral OPSX entity detail contract.
- Treat active and archived change directories as objective entities whose primary truth is their file tree.
- Use schema metadata only as an optional enhancement for grouping files into artifacts.
- Preserve information display when `.openspec.yaml` points to a missing, renamed, invalid, or upgraded schema.
- Route every Markdown artifact shown in detail surfaces through the same `onReadDocument` pipeline with a generic artifact document identity.
- Centralize tolerant schema/entity/file helper logic in shared utilities so live server, static export, and static runtime do not fork behavior.
- Drive implementation with BDD/TDD and capture regressions for custom and unknown schema archives.

## Breaking Change

- Archive detail SHALL no longer depend on `proposal.md`, `tasks.md`, `design.md`, or `specs/**/spec.md` as its platform model.
- Archive detail SHALL no longer return or render a legacy `Change` object as the page's primary data.
- Legacy spec-driven files may appear as ordinary files or schema artifacts, but they are not privileged existence requirements.
- Static export snapshots may change shape to preserve entity files and artifact grouping rather than synthesizing proposal/tasks fields.

## Non-Goals

- Do not add compatibility shims that convert custom schema archives into fake `proposal/tasks/design` documents.
- Do not hardcode `opsx-collab-pr-loop`, `spec-driven`, or any other schema name in the entity detail engine.
- Do not block archive display because a schema cannot be resolved or parsed.
- Do not redesign the active change workflow editor beyond the shared utility/model changes needed for consistency.

## Acceptance Boundary

- Given `openspec/changes/archive/<archive-id>` exists, `/archive/<archive-id>` renders objective archive detail even when root `proposal.md` is absent.
- Given the archive references an unavailable schema, the detail still displays all readable files and exposes non-fatal diagnostics.
- Given a schema can be resolved, artifacts are derived from schema `generates`/output paths and matched against files without schema-name branching.
- Given artifact Markdown is displayed, `onReadDocument` receives `kind: "artifact"` with schema/artifact/path metadata.
- Given static export is used, live and static archive detail use the same entity/file/artifact mapping semantics.
