## User Input

> OpenSpec 1.5.0 发布了 Stores (very early beta) 功能——一种组织 specs 和 changes 的更简单方式，取代 workspace 和 initiative 模型。需要跟进这个新功能。
>
> 首期目标是**只读发现**：在 openspecui 里加一个 Stores 入口，入口必须有 **beta 角标**，只读展示本机已注册的 store 列表与监控状态。阶段 1 的 root 切换方向已确认为 server 级活跃 store（本次不实现）。

## Objective Scope

- 跟进 OpenSpec 1.5.0，将 `references/openspec` 更新到 v1.5.0，并深入理解 Stores 功能的数据模型与 CLI 接口。
- **版本律前置更新**：把 openspecui 4.x 的 CLI 兼容范围从 `>=1.3.0 <1.5.0` 推进到 `>=1.3.0 <1.6.0`（target series 1.5），否则 1.5.0 用户会被主界面阻塞、stores 面板进不去。
- 在 openspecui 新增一个**只读**的 Stores 面板（带 Beta 角标），展示本机已注册的 store 列表及其健康监控状态。
- 通过 `openspec store list --json` 和 `openspec store doctor --json` 获取数据，遵循 CLAUDE.md 的 CLI-First 原则。
- 后端新增 `storesRouter`（query + 响应式订阅），前端新增面板组件并挂载到导航。
- 提供优雅降级：当 openspec CLI < 1.5.0 或不可用时，面板给出提示而不阻塞主界面。

## Non-Goals

- **不**实现 root 切换 / 活跃 store 选择（阶段 1，已确认方向但本次不做）。
- **不**实现 store 生命周期管理（setup/register/unregister/remove，阶段 2）。
- **不**修改单 `projectDir` 架构，**不**改动 spec/change 读取逻辑。
- **不**将 stores 数据纳入静态/SSG 快照（`static-data-provider`），stores 仅存在于 live 模式。
- **不**自行解析 `registry.yaml` 路径（避免 `<dataDir>` 解析与 openspec 不一致），统一走 CLI。
- **不**处理 workspace/initiative 迁移（openspecui 从未有该旧概念）。

## Acceptance Boundary

- `references/openspec` 处于 v1.5.0，主仓工作区无由此产生的脏改动。
- openspecui 4.x 版本律接受 openspec CLI `>=1.3.0 <1.6.0`，1.5.x 不再被阻塞，1.3.x 保持 legacy-compatible，1.4.x/1.5.x 为 current。相关单元测试更新并通过。
- openspecui 后端新增 `storesRouter`，提供：`list`（query）、`subscribe`（subscription，响应式）、`doctor`（query，可选 id）。数据来自 openspec CLI 的 `--json` 输出，字段对齐 snake_case 契约。
- 前端新增 Stores 面板，标题与导航入口带 **Beta** 角标；展示每个已注册 store 的 id、root、健康状态（metadata/git/openspec root）、remote。
- 当 CLI 不可用或版本低于 1.5.0 时，面板优雅降级（提示文案 + beta 说明），不抛错、不阻塞主界面。
- stores 数据仅 live 模式可见，**不**进入 SSG 静态快照。
- 本地 CI 等价检查通过：`pnpm format:check`、`pnpm lint:ci`、`pnpm typecheck`、`pnpm test:ci`、`pnpm test:browser:ci`（或按包范围的合理子集并在 PR 注明）。
- 包含 `.changeset/*.md`（影响 `@openspecui/core`/`server`/`web` 发布包行为）。
- 本 change 的 loop artifacts（intake / research-plan / implementation / checkpoints）随实现同步更新并通过 `openspec validate`。
