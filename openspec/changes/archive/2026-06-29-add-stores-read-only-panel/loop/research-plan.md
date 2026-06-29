## Research Findings

### OpenSpec 1.5.0 Stores 数据模型（来自 `references/openspec` v1.5.0）

- **Store = 独立可注册的 OpenSpec 规划仓库**，取代 workspace + initiative。CHANGELOG 标注 "very early beta — expect breaking changes"。
- 四类存储位置：`<storeRoot>/openspec/{specs,changes}`（共享 committed）、`<storeRoot>/.openspec-store/store.yaml`（身份 `{version:1,id,remote?}`，共享 committed）、`<dataDir>/stores/registry.yaml`（本机私有）、worksets（本机私有）。
- `<dataDir>` = `~/.local/share/openspec`（macOS/Linux）。
- store git 后端只做 setup 时 init + 一次 commit，永不 pull/push/sync。

### CLI 命令面（`references/openspec/src/commands/store.ts`）

```
openspec store setup/register/unregister/remove/list|ls/doctor [--json]
```

JSON 契约（`docs/agent-contract.md` §4.11，snake_case）：
- `store list --json` → `{stores:[{id, root}], status:[]}`。
- `store doctor --json` → `{stores:[{id, root, metadata_path, openspec_root:{present,config,specs,changes,archive,healthy,status:[]}, metadata:{present,valid,id?,remote?}, git:{is_repository,has_commits,has_uncommitted_changes,has_remote,origin_url}}], status:[]}`。
- 失败时顶层对象为 null + `status` 带 error 诊断，exit code 1。

### openspecui 现状耦合与约束

- **单 `projectDir` 模型**：`CliExecutor`（`packages/core/src/cli-executor.ts:31-34,46`）绑定一个 projectDir。server 实例 = 一个项目目录。
- router 单文件 `packages/server/src/router.ts`，sub-router 挂 `appRouter`。响应式订阅用 `createReactiveSubscription`。
- **版本门禁**：`packages/web/src/components/cli-health-gate.tsx` 用 `classifyOpenSpecCliVersion`（`packages/core/src/openspec-compat.ts`）。当前 `OPENSPEC_CLI_ACCEPTED_RANGE = '>=1.3.0 <1.5.0'`，1.5.0 会被 `blocksCoreInteractions` 阻塞主界面（stable 门禁）。
- **版本来源信息已可复用**：`trpc.cli.checkAvailability` 返回 `{available, version, ...}`，stores 错误展示直接复用前端已缓存的 `version`，无需新增取版本通道。
- **watcher 只监听 projectDir**；`registry.yaml` 在 `~/.local/share/openspec`（不可达）——stores 订阅须轮询，不依赖 watcher。
- openspecui 无 workspace/initiative 旧概念，纯新增。

## Decision & Plan (For Approval)

### 核心范式：beta 功能容错模型（本 change 的设计核心）

beta 功能**不走版本律门禁**，靠运行时强容错。CLI 数据用 **zod 宽松验证**（`passthrough` + 字段可选），把失败归类为两类错误，前端按类型差异化处理：

| 错误类型 | 触发 | 后端行为 | 前端行为 |
|---------|------|---------|---------|
| **异常一：数据不兼容** | zod 宽松验证仍失败（CLI 真正破坏性数据结构变更） | 捕获，端点返回 `{available:true, error:{kind:'data-incompatible', message, cliVersion}}` | **客观显示错误 + 版本来源信息**（不隐藏、不崩溃） |
| **异常二：指令变更/缺失** | `store list/doctor` 命令本身不存在或用法改变（非零退出 / 找不到子命令） | 捕获，端点返回 `{available:false, error:{kind:'command-unavailable', message, cliVersion}}` | **隐藏 Stores 入口** |

- **版本信息必备**：两种错误载荷都带 `cliVersion`（来自 `checkAvailability`），前端错误展示必须呈现。
- **前端永不崩溃**：stores 数据通道用 React Query / subscription 的 error 状态承载，组件对 `error`/`undefined` data 做防御渲染。
- **宽松验证**：zod schema 用 `.passthrough()`（容忍 CLI 新增字段）+ 关键字段可选，只有结构根本性不兼容才落异常一。

### 文件级计划

**A. 版本律维护（stable，独立于 stores）** — `packages/core/src/openspec-compat.ts`
- `OPENSPEC_CLI_TARGET_SERIES` `'1.4'`→`'1.5'`；`TARGET_MIN_VERSION` `'1.4.0'`→`'1.5.0'`；`ACCEPTED_RANGE` `'>=1.3.0 <1.5.0'`→`'>=1.3.0 <1.6.0'`；`RECOMMENDED_RANGE`→`'>=1.4.0 <1.6.0'`；`NEXT_SERIES_MIN_VERSION` `'1.5.0'`→`'1.6.0'`；`REFERENCE_TAG_PATTERN` `'v1.4.*'`→`'v1.5.*'`。保留 1.3 legacy。更新单元测试。
- 注：这是常规 stable 维护；**stores 的可用性不依赖它**（即使版本律没放行，stores 也靠容错自处）。

**B. 类型层（宽松验证 + 错误归类）** — 新增 `packages/core/src/store-types.ts`
- zod 宽松 schema：`StoreListResultSchema` / `StoreDoctorResultSchema`（`.passthrough()` + 字段可选）。
- 错误类型：`StoreFeatureError = {kind:'data-incompatible'|'command-unavailable'; message; cliVersion?}`。
- 端点统一返回型：`StoreFeatureResult = {available:boolean; stores:StoreListEntry[]; error?:StoreFeatureError; cliVersion?:string}`。
- 从 `packages/core/src/index.ts` 导出。

**C. CLI 执行器 + 错误归类** — `packages/core/src/cli-executor.ts`
- 新增 `listStores()` / `doctorStores(id?)`（仅 `execute([...,'--json'])`，不做解析）。
- 新增**归类辅助**（可放 `store-types.ts` 或 server 侧）：执行结果 → `{kind:'ok'|'data-incompatible'|'command-unavailable'}`。判定逻辑：
  - exit 0 且 zod 通过 → ok；
  - exit 0 但 zod 失败 → data-incompatible（异常一）；
  - 非 0 退出 / 子命令缺失 → command-unavailable（异常二）。

**D. 后端 router** — `packages/server/src/router.ts`
- 新增 `storesRouter`（挂 `appRouter.stores`）：
  - `stores.list` (query)、`stores.subscribe`（轮询，~5s，`unref`）、`stores.doctor`（query `{id?}`）。
  - 每个端点包 try/catch，输出 `StoreFeatureResult`，**永不抛**未捕获错误。`cliVersion` 从 `cliExecutor.checkAvailability()` 取（或复用上下文缓存）。

**E. 前端** — `packages/web/src/`
- `components/stores/stores-panel.tsx`：Beta 角标；data 正常 → 列表；`error.kind==='data-incompatible'` → 显示错误 + `cliVersion`；`error.kind==='command-unavailable'` → 隐藏入口（父级导航据此不渲染）。
- 订阅 hook 复用 `trpc.cli.checkAvailability` 的 `version` 作版本来源。
- 仅 live 模式渲染；对 undefined/error data 防御渲染，不崩溃。

**F. Changeset** — `.changeset/*.md`，标记 `@openspecui/core`/`server`/`web` minor。

## Capability Impact

### New or Expanded Behavior

- **beta 功能容错范式**：zod 宽松验证 + 两类错误归类 + 版本信息展示 + 按错误类型显隐入口。
- Stores 只读面板（beta）。
- 版本律接受 1.5.x（stable 维护）。

### Modified Behavior

- 主门禁（`cli-health-gate`）stable 行为不变；版本常量更新。
- 主布局导航新增 Stores 入口（可按异常二隐藏），不改动现有面板。

## Risks and Mitigations

| 风险 | 缓解 |
|------|------|
| beta CLI 形态在 1.6 变动 | zod `.passthrough()` 容忍新增字段；错误归类集中一处；前端字段访问防御性。 |
| 误把"指令缺失"当"数据不兼容" | 归类以 exit code + zod 双重判定：非 0 → command-unavailable；0 但 zod 失败 → data-incompatible。 |
| 错误展示缺版本信息 | 错误载荷强制带 `cliVersion`；前端 error UI 把版本作为必显字段；契约测试覆盖。 |
| 前端崩溃 | 组件对所有 data 形态（undefined/error/空）防御渲染；React Query error 状态承载。 |
| watcher 不可达 registry | 轮询订阅 + 手动刷新，UI 明示间隔。 |
| stores 误进 SSG | 仅 live 渲染，不进 `static-data-provider`；SSG 构建验证。 |
| doctor 慢 | doctor 按需 query（带 id），不强制全量。 |

## Verification Strategy

### 本地检查（CI 等价）
- `pnpm format:check` / `lint:ci` / `typecheck` / `test:ci` / `test:browser:ci`。
- SSG 守卫：`pnpm --filter @openspecui/web build:ssg`，stores 不进快照。

### 功能验收
- CLI 1.5.0+ 且注册了 store：面板显示列表 + 健康 + beta 角标。
- 模拟**异常一**（喂给 zod 一个结构错乱的 JSON）：面板显示错误 + 版本信息，不崩溃、不隐藏。
- 模拟**异常二**（mock `store list` 非零退出）：Stores 入口隐藏。
- CLI < 1.5.0（无 store 子命令）：入口隐藏（异常二路径）。
- 版本律：1.5.0 不再被主门禁阻塞；1.3.x 仍 legacy 提示。
- `openspec validate add-stores-read-only-panel --type change` 通过。

### 回归
- 现有 stable 功能与面板行为不变。
- SSG 产物不含 stores 运行时数据。
