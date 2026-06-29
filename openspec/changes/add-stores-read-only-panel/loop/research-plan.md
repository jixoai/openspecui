## Research Findings

### OpenSpec 1.5.0 Stores 数据模型（来自 `references/openspec` v1.5.0 源码）

- **Store = 独立可注册的 OpenSpec 规划仓库**，取代 1.4.x 的 workspace + initiative 模型。CHANGELOG 1.5.0 明确标注 "very early beta — expect rough edges and breaking changes"。
- 四类存储位置：
  - `<storeRoot>/openspec/{specs,changes}` — 共享（committed），规划内容。
  - `<storeRoot>/.openspec-store/store.yaml` — 共享（committed），身份：`{version:1, id, remote?}`。
  - `<dataDir>/stores/registry.yaml` — 本机私有，注册表：`{version:1, stores:{<id>:{backend:{type:'git', local_path, remote?, branch?}}}}`。
  - worksets — 本机私有。
- `<dataDir>` = `~/.local/share/openspec`（macOS/Linux），由 `getGlobalDataDir()` 解析，支持 env 覆盖。
- 一个 store id 在一台机器上只允许一个 checkout（冲突码 `store_id_conflict` / `store_path_conflict`）。
- store 的 git 后端**只做** setup 时 `git init` + 一次初始 commit，**永不** pull/push/sync（`src/core/store/git.ts:14-16` 明确注释）。

### CLI 命令面（`references/openspec/src/commands/store.ts`）

```
openspec store setup/register/unregister/remove/list|ls/doctor [--json]
```

全局 flag `--store <id>` 流入普通命令（`new change`/`status`/`list`/`show`/`validate`/`archive`/`instructions`），按 `resolveOpenSpecRoot`（`src/core/root-selection.ts`）优先级解析 root：`--store` > 最近合格 `openspec/` > config 的 `store:` 指针。

### JSON 契约（`references/openspec/docs/agent-contract.md` §4.11，snake_case）

- `store list --json` → `{stores:[{id, root}], status:[]}`（list 仅含 id+root，无 metadata_path）。
- `store doctor --json` → `{stores:[{id, root, metadata_path, openspec_root:{present, config, specs, changes, archive, healthy, status:[]}, metadata:{present, valid, id?, remote?}, git:{is_repository, has_commits, has_uncommitted_changes, has_remote, origin_url}}], status:[]}`。
- 统一诊断信封 `{severity, code, message, target?, fix?}`，失败时各顶层对象为 null 且 `status` 带 error，exit code 1。

### openspecui 现状耦合（关键约束）

- **单 `projectDir` 模型**：`CliExecutor`（`packages/core/src/cli-executor.ts:31-34,46`）构造时绑定一个 projectDir，所有 openspec 命令以其为 cwd。`server.ts:148` `new CliExecutor(configManager, config.projectDir)`，整个 server 实例 = 一个项目目录。
- router 为单文件 `packages/server/src/router.ts`，sub-router 挂到 `appRouter`（末尾 `router({...})`）。响应式订阅统一用 `createReactiveSubscription`（`packages/server/src/reactive-subscription.ts`）。
- openspecui **无** workspace/initiative 旧概念（grep 确认无相关代码），无需迁移，纯新增。
- 现有 watcher（`ctx.watcher`）只监听 `projectDir`；`registry.yaml` 在 `~/.local/share/openspec`，**不在** projectDir 下——这是响应式订阅的关键约束。

### ⚠ 版本律阻塞（前置依赖，必须同批处理）

- `packages/core/src/openspec-compat.ts` 当前硬编码：`OPENSPEC_CLI_ACCEPTED_RANGE = '>=1.3.0 <1.5.0'`，`OPENSPEC_CLI_TARGET_SERIES = '1.4'`，`OPENSPEC_CLI_NEXT_SERIES_MIN_VERSION = '1.5.0'`。
- 后果：装了 openspec 1.5.0 的用户会被 `classifyOpenSpecCliVersion` 判为 `unsupported` + `blocksCoreInteractions: true`，**主界面被阻塞**，stores 面板根本进不去。
- 因此本 change **必须**把版本律推进到接受 1.5.x（target series 提到 1.5、accepted range 提到 `<1.6.0`、reference tag 提到 `v1.5.*`），这是 stores 对接的前置依赖。这会把版本律 spec（`openspec-cli-integration`）一并纳入 delta。

## Decision & Plan (For Approval)

### 总策略
阶段 0 严格只读，不触碰单 projectDir 架构与 spec/change 读取逻辑。数据全走 openspec CLI 的 `--json`，不自解析 registry 路径（避免 `<dataDir>` 解析漂移）。响应式订阅因 watcher 不可达 `<dataDir>`，采用**定时轮询**（仿 `systemRouter.subscribe` 的 `setInterval` 模式）+ 手动刷新。

### 文件级计划

**A. 版本律前置更新 (`packages/core/src/openspec-compat.ts`)** — spec delta 见 `openspec-cli-integration`
- `OPENSPEC_CLI_TARGET_SERIES` `'1.4'` → `'1.5'`
- `OPENSPEC_CLI_TARGET_MIN_VERSION` `'1.4.0'` → `'1.5.0'`
- `OPENSPEC_CLI_ACCEPTED_RANGE` `'>=1.3.0 <1.5.0'` → `'>=1.3.0 <1.6.0'`
- `OPENSPEC_CLI_RECOMMENDED_RANGE` `'>=1.4.0 <1.5.0'` → `'>=1.4.0 <1.6.0'`
- `OPENSPEC_CLI_NEXT_SERIES_MIN_VERSION` `'1.5.0'` → `'1.6.0'`
- `OPENSPEC_CLI_REFERENCE_TAG_PATTERN` `'v1.4.*'` → `'v1.5.*'`
- 保留 `OPENSPEC_CLI_LEGACY_SERIES='1.3'` / `OPENSPEC_CLI_LEGACY_RANGE`，1.4 升为 recommended 一员。
- 同步更新其单元测试与任何硬编码版本断言。

**B. 类型层 (`packages/core/src/`)**
- 新增 `store-types.ts`，用 Zod 定义并与 snake_case JSON 契约对齐：
  - `StoreListEntrySchema` → `{id, root}`
  - `StoreDiagnosticSchema` → `{severity, code, message, target?, fix?}`
  - `StoreDoctorStoreSchema`（含 `openspec_root`、`metadata`、`git` 子对象）
  - `StoreListResultSchema`、`StoreDoctorResultSchema`
  - 导出对应 TS 类型。
- 在 `packages/core/src/index.ts` 导出（前端用 `import type`，符合 CLAUDE.md 的 browser-target 规范）。

**C. CLI 执行器 (`packages/core/src/cli-executor.ts`)** — spec delta 见 `openspec-cli-integration` Stores CLI Query Mapping
- 仿现有 `schemas()`（`execute(['schemas','--json'])`）模式，新增：
  - `listStores(): Promise<CliResult>` → `execute(['store','list','--json'])`
  - `doctorStores(id?: string): Promise<CliResult>` → `execute(['store','doctor', ...(id?[id]:[]), '--json'])`

**D. 后端 router (`packages/server/src/router.ts`)**
- 新增 `storesRouter`，挂到 `appRouter.stores`：
  - `stores.list` (query) — 调 `cliExecutor.listStores()`，解析 JSON，失败返回空列表 + available 标志。
  - `stores.doctor` (query, `{id?: string}`) — 调 `cliExecutor.doctorStores(id)`。
  - `stores.subscribe` (subscription) — 轮询 `listStores`（间隔 ~5s，`timer.unref()`），并暴露手动刷新能力；用 `observable` 直推，不依赖 watcher。
- CLI 不可用/版本不足时，端点返回 `{stores:[], available:false, error}`，不抛错。

**E. 前端 (`packages/web/src/`)** — spec delta 见 `opsx-ui-views` Stores Discovery Panel
- 新增 `components/stores/stores-panel.tsx`：列表展示 id、root、健康状态（聚合 doctor 的 metadata/git/openspec_root.healthy）、remote。
- **Beta 角标**：面板标题 + 导航入口处加 `Beta` badge。
- 新增订阅 hook（仿 `use-subscription.ts` 现有模式），调 `stores.subscribe`。
- 挂到主布局导航（仅 live 模式渲染，SSG 模式跳过——通过现有 live/static 模式判断，不进 `static-data-provider`）。
- 降级 UI：`available:false` 时显示提示文案 + beta 说明。

**F. Changeset**
- 新增 `.changeset/*.md`，标记 `@openspecui/core`（版本律）、`@openspecui/server`、`@openspecui/web` 为 minor。

## Capability Impact

### New or Expanded Behavior

- 新增只读 Stores 面板（beta）：用户可在 UI 看到本机所有已注册 openspec store 及其健康状态。
- 新增后端 `storesRouter`（list / doctor / subscribe）。
- 新增 store 相关类型与 `CliExecutor.listStores/doctorStores`。

### Modified Behavior

- 主布局导航新增 Stores 入口（带 beta 角标）。不改动任何现有 spec/change/git/dashboard 行为。

## Risks and Mitigations

| 风险 | 缓解 |
|------|------|
| Stores 是 early beta，CLI flag/JSON 形态可能在 1.6 变动 | 类型与 CLI 调用收拢到单一模块（`store-types.ts` + `cli-executor` 两个方法），变动时局部修改；前端字段访问集中。 |
| `registry.yaml` 不在 projectDir，watcher 不可达，订阅不实时 | 用轮询（5s）+ 手动刷新按钮，UI 明示"自动刷新间隔"，不假装实时。 |
| CLI < 1.5.0 或不可用 | 端点降级返回 `{stores:[], available:false}`；前端显示引导（升级 CLI）而非报错阻塞。 |
| 误把 stores 数据进 SSG 静态快照 | stores 面板仅在 live 模式渲染；明确不新增 `static-data-provider` 条目（遵守 CLAUDE.md SSG 规范）。 |
| `store doctor` 对大量 store 较慢 | doctor 作为按需 query（带可选 id），不在 list/subscribe 里强制全量 doctor；前端按需展开单个 store 详情时才拉 doctor。 |
| 跨平台 `<dataDir>` 差异 | 不自解析路径，全走 CLI，规避此风险。 |

## Verification Strategy

### 本地检查（CI 等价，匹配 AGENTS.md 门禁）
- `pnpm format:check`
- `pnpm lint:ci`
- `pnpm typecheck`
- `pnpm test:ci`
- `pnpm test:browser:ci`
- SSG 守卫（CLAUDE.md）：`pnpm --filter @openspecui/web build:ssg`，确认 stores 不进静态快照、构建通过。

### 功能验收
- 在装有 openspec 1.5.0 且已注册 ≥1 个 store 的环境：面板显示 store 列表 + 健康状态，beta 角标可见。
- `openspec store setup` 一个临时 store 后，面板（轮询或手动刷新）能看到新 store 出现。
- 模拟 CLI 不可用（临时改坏 runner 配置）：面板显示降级提示，主界面其余功能不受影响。
- `openspec validate change add-stores-read-only-panel` 通过。

### 回归
- 现有 spec/change/archive/dashboard/git 面板行为不变。
- SSG 构建产物不含 stores 运行时数据。
