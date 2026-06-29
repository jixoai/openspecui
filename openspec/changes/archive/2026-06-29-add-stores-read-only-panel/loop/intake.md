## User Input

> OpenSpec 1.5.0 发布了 Stores (very early beta) 功能。需要跟进。
>
> **底层版本逻辑更新（核心原则）**：对于 beta 功能，openspecui **不负责兼容性**。但这意味着所有 beta 功能在后台必须有**强容错能力**——即使 CLI 没有这个功能、或返回异常，也要捕获错误并由前端展示，**前端永不因此崩溃**。
>
> 错误分两种，处理方式不同：
> - **异常一（数据不兼容）**：openspec-cli 提供的数据结构 openspecui 解析不了。用 zod 对 CLI 输出做**宽松验证**，只有真正破坏性的不兼容数据结构才异常。对 Stores 这种弱 beta 入口，遇到异常一就**客观显示错误 + 版本来源信息**即可（版本信息非常重要）。
> - **异常二（指令用法变了）**：openspec-cli 直接改了指令用法（重大破坏性更新）。对弱 beta 入口，遇到异常二就**直接隐藏入口**。
>
> 像 Stores 这种 beta 功能是弱入口：低版本没有、当前版本不稳定。版本信息在错误展示中是必备字段。

## Objective Scope

- 跟进 OpenSpec 1.5.0，`references/openspec` 已更新到 v1.5.0（已完成，理解 Stores 数据模型与 CLI 接口）。
- **确立 beta 功能容错范式**：beta 功能不走版本律门禁，靠运行时强容错。所有 CLI 数据用 zod 宽松验证；错误分两类（数据不兼容 / 指令变更），各自有明确的前端处理策略；前端永不崩溃；错误展示必须携带版本来源信息。
- 在 openspecui 新增一个**只读**的 Stores 面板（带 Beta 角标），展示本机已注册的 store 列表与健康状态。Stores 作为该范式的首个落地实践。
- 后端 `storesRouter` 对 `openspec store list/doctor --json` 做宽松解析与错误归类，前端按错误类型决定"显示错误+版本"或"隐藏入口"。
- **独立的版本律维护**：把 openspecui 4.x 的 CLI 接受范围推进到 `>=1.3.0 <1.6.0`（target 1.5）。这是 stable 功能兼容性的常规维护（1.5.0 目前被主门禁阻塞），**独立于** stores 的 beta 容错——stores 不依赖它放行。

## Non-Goals

- **不**让 beta 功能依赖版本律门禁放行（beta 靠容错，不靠版本号判断）。
- **不**实现 root 切换 / 活跃 store（阶段 1）、store 生命周期管理（阶段 2）。
- **不**修改单 `projectDir` 架构、**不**改动现有 spec/change 读取逻辑。
- **不**把 stores 数据纳入静态/SSG 快照（仅 live 模式）。
- **不**自解析 `registry.yaml` 路径（统一走 CLI，避免 `<dataDir>` 漂移）。
- **不**对 stable 功能改变现有版本门禁语义（`cli-health-gate` 的 stable 行为保持不变）。

## Acceptance Boundary

- `references/openspec` 处于 v1.5.0。
- **版本律维护**：openspecui 4.x 接受 openspec CLI `>=1.3.0 <1.6.0`，1.5.x 为 current，1.3.x legacy-compatible，1.4.x current。相关测试更新通过。（独立于 stores，stable 维护。）
- **beta 容错范式落地**：
  - Stores 相关 CLI 输出用 zod 宽松验证（`passthrough`/可选字段），解析失败被归类为"异常一"，不抛未捕获错误。
  - `openspec store list/doctor` 命令缺失或用法改变被归类为"异常二"。
  - 后端永不因 stores 数据问题导致 server 崩溃；端点返回结构化错误载荷（含错误类型）。
  - 前端：异常一 → 客观显示错误文案 + **版本来源信息**（复用 `cli.checkAvailability().version`）；异常二 → 隐藏 Stores 入口。前端永不崩溃。
- Stores 面板（带 Beta 角标）在 CLI 1.5.0+ 且数据正常时，展示每个已注册 store 的 id、root、健康状态、remote。
- stores 数据仅 live 模式可见，不进 SSG 快照。
- 本地 CI 等价检查通过；包含 `.changeset/*.md`（`@openspecui/core`/`server`/`web`）。
- 本 change 的 loop artifacts 与 spec deltas 随实现同步并通过 `openspec validate`。
