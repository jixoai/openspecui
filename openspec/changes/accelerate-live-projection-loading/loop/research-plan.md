<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Record measured live-projection causes and the limits of those measurements.
2. Define one systemic projection-work protocol rather than ad hoc route caches.
3. Split Dashboard, Changes, Root Context, and OPSX performance work into independently provable packages.
4. Preserve reactive correctness, provenance, mutation authority, and owner acceptance boundaries.

Original request (2026-07-23): "请你深入调查，给出一份持有客观证据的调查报告，并给出“系统性的解决方案”，并将它整理成 openspec change。"
-->

## Research Findings

完整原始命令、输入规模与测量表在
[`research/2026-07-23-live-projection-evidence.md`](../research/2026-07-23-live-projection-evidence.md)。

### 已验证事实

```text
WebSocket transport first Root Context event               73ms
same-root reactive acquisition                    1,529ms .. 2,705ms
Dashboard first WebSocket payload                 9,853ms .. 11,488ms
Dashboard fresh-client reload on same Server               8,841ms
Changes rows first WebSocket payload                         7,079ms
OPSX Config Bundle first payload                            10,152ms
OPSX Status List first payload                              16,068ms
OpsxKernel full warmup                                      10,551ms
```

当前输入仅有 2 个 Git worktree、13 个 Spec、3 个 active Change、53 个 archive；因此这不是
“极大目录必然慢”的解释。直接执行 `loadDashboardOverview()` 为 2,795ms，Git 快照为 667ms，
Dashboard 服务已缓存 `getCurrent()` 为 0.12ms，显著低于页面首包。慢路径发生在共享服务、CLI
和投影调度的组合层。

### 当前拓扑与问题

```text
route mount
  +-- dashboard.subscribe --------------------+-- refresh aggregate Dashboard
  +-- opsx.subscribeConfigBundle -------------+-- wait Manager -> Kernel warmup
  +-- opsx.subscribeStatusList ---------------+-- wait Manager -> Kernel warmup
  `-- change.subscribe (Changes route only) --+-- wait Manager -> filesystem projection

each Root-owned subscription
  -> new ReactiveContext
  -> serialized Manager acquisition
  -> checkAvailability + doctor + context
  -> owner operation
```

1. Web 缓存只在 `useSubscription` 的模块级 `Map` 中。路由重挂载可复用，浏览器刷新必然丢失。
2. Server `createReactiveSubscription()` 每个 subscriber 都创建新的 `ReactiveContext` 并执行任务；
   目前没有跨 subscriber 的 projection single-flight 或首个已验证快照 replay。
3. `dashboard.subscribe` 强制调用 `refresh('subscription')`。它绕过已存在的
   `DashboardOverviewService.getCurrent()` 内存快照，后者在同一输入中为 0.12ms。
4. `PlanningRootServiceManager.acquireOperation()` 在根身份不变时仍调用
   `resolveServerRootContext()`。生产命令测得每次都要付出 CLI 可用性与 `doctor/context` 成本。
5. `opsx.subscribeStatusList` 等待 `kernel.waitForWarmup()`；warmup 会读取 Schema、每个 Change
   的 Status、Apply Instructions、每个 artifact 的 Instructions/输出，之后才输出 Status List。
   它将低优先级、非首屏事实塞入高频状态投影的关键路径。
6. Dashboard 的单体聚合把概要、趋势、Git 快照放进同一个首包。直接阶段测量表明 Git 不是此输入
   的主因，但聚合形状使任何未来慢叶子都能再次阻塞整页。

### 必须保留的约束

- Root/Store/Reference provenance、Root generation、Git binding token 和 Root action authority
  不是可缓存的展示装饰；A -> B 变化必须退休 A 的结果。
- 订阅仍是“服务端 Push invalidation -> 客户端 Pull projection”，缓存不是新的事实源。
- 已缓存快照可以用于显示，不能在连接中、刷新中、错误中或根不匹配时授权 mutation。
- 传输错误、CLI 错误、部分数据、更新中和当前空数据仍是不同状态；不得把它们合并成“加载完成”。
- Owner 执行最终浏览器走查。此 Change 的自动化证据止于 checked Vitest、真实 tRPC 基准和基础
  组件夹具。

## Decision & Plan (For Approval)

### 决策：引入投影工作协议，而非散落的 route cache

所有高成本 live projection 统一经过一个 Server-owned 的 `Projection Work` 协议。它不是通用
数据 ORM，也不替代 React 状态；它只解决“给定当前有效输入，如何安全地共享、分阶段、失效和交付
一次可观察计算”。

```text
Projection Request
  -> derive identity + input fingerprint
  -> cache lookup
       hit/current     -> snapshot(display only or current as declared)
       miss/stale      -> join or create one Work
  -> bounded scheduler
       foreground leaf first
       background / optional leaves later
  -> event stream
       snapshot | stage | batch | complete | failed
  -> reactive invalidation retires key / starts next generation
```

每个 Work 的身份必须至少包含：

```text
{ projectionKind,
  planningRoot identity + source + Store selector,
  owner generation / binding token where applicable,
  explicit input selector,
  input fingerprint or invalidation generation,
  protocol version }
```

输入不同、根变化、Store 变化、Git binding 变化、协议版本变化时不得复用结果。`snapshot` 必须带
provenance 与 freshness；只有 owner 明确声明为 `current` 的 snapshot 才能授权读取后的动作。

### 协议事件

```text
snapshot(current | stale-display-only)
stage(started | settled | failed, stable payload optional)
batch(item[] | progress { completed, total | unknown })
complete(final snapshot)
failed(error, retained snapshot optional)
```

初始状态不发伪 `updating`。`stage` 只能代表实际 Work 的阶段转换；WebSocket
`connecting/pending` 和文件失效是独立事实。事件有单调 Work generation，取消/退休的 A 不得向 B
发布、清缓存或覆盖进度。

### 施工顺序

#### P1. 观测与资源调度基础

Production owner: Server projection infrastructure.

1. 在 `subscription -> Manager -> projection` 边界记录有界、进程内 phase trace：请求、传输开始、
   Root-ready、cache-hit/join/start、每个 leaf settled、first stable payload、complete/error/cancel。
2. 定义 Work identity、single-flight registry、LRU memory budget、显式 `invalidate(key)` 和
   foreground/background 资源类别。内存预算、CLI 并发度、批尺寸由基准配置给出，不写死为“越多越快”。
3. 让前台 Work 可以 join 已在运行的同 key Work；后台预热只能低优先级运行，前台等待时必须让出
   受限 CLI/Worker 槽位或被取消。

精准红例：两个同 identity 的 subscriber 各自调用叶子 loader 两次。

绿例：两个 subscriber 共享一次 loader、各自收到正确 generation 的 snapshot；根 B 出现后 A 的晚到
事件不改变 B。

#### P2. Root Context current-snapshot gateway

Production owner: `PlanningRootServiceManager` / Root Context server boundary.

1. 把“已验证当前 Root”与“重新验证 Root”拆开。当前 generation 的读取取得 lease 时不重复
   `doctor/context`；只有根/数据域失效、显式 refresh 或 generation 退休才建立下一次解析。
2. 将 Root Context 本身作为一个带 freshness 的 Work；保留当前 A 的 display snapshot，同时明确
   `refreshing` 不可授权。不要为性能删掉当前 Root action lock。
3. 同一 transition lane 内共享一次解析 promise；保留现有 record 退休、active operation drain、
   diagnostic/evidence 和 reactive dependency tracking。

精准红例：同一未变根上的两个 reactive operation 触发两组 `doctor/context`。

绿例：同 generation 只执行一组；失效后恰好执行一组 B；移除 generation retirement 后 A -> B 断言
必须失败。

#### P3. Dashboard 分阶段投影

Production owner: Dashboard server router + Dashboard route.

```text
Dashboard shell
  <- Summary projection        counts / recent specs / recent changes
  <- Trends projection         optional statistics
  <- Git projection            worktrees / entries
  <- Workflow summary          independently owned OPSX fact
```

1. 用独立 router/subscription 物理拆分 Summary、Git、趋势和可选 workflow facts。Summary 的输入仅包含
   首屏必须的 metadata；Git 失败/更新不能阻塞 Summary。
2. `dashboard.subscribe` 先 replay 当前服务快照，再在背景计算下一代；不要每次订阅都把完整
   `refresh()` 作为唯一首包。
3. Route 取消整页 `Loading dashboard...` 对所有事实的绑定。各区域根据自己的
   `unknown | snapshot | updating | error` 状态渲染，稳定区域保留而慢区显示自身状态。
4. Dashboard Git 使用现有 Code binding token；缓存不改变 Git scope current-authority 规则。

精准红例：预加载的 Dashboard current snapshot 仍被 `refresh()` 阻塞，或慢 Git 令 Summary 不可见。

绿例：current Summary 立即显示、Git 后到；Git B 不会复用/标记 Git A。

#### P4. Changes MapReduce 批流

Production owner: Change projection server/router + ChangeList route.

```text
directory ids -> bounded mapper -> ChangeRow batches -> reducer/index -> complete
                 | progress { completed, total }
```

1. 将 `listChangesWithMeta()` 的全量数组首包替换为带目录 inventory、批 rows、进度和终态的流。
   输入中 total 未知时明确传递 `unknown`，不得伪造百分比。
2. 每个 row 仅计算 List 所需的 name、任务投影、时间；详情、文档 checklist、Status、Apply、artifact
   说明仍按需请求。更改后只重算受影响 row/batch。
3. Web 使用稳定 row identity 和流体列表动画；已完成行不会因后续慢 row 或 Status 而消失。终态失败
   显示已完成 batch 与错误，不得变成“没有 Change”。

精准红例：一个受控慢 Change 使之前已完成行不能显示。

绿例：首批行和明确进度先到，慢 Change 后到；移除 batch emission 后此断言失败。

#### P5. OPSX demand planner

Production owner: `OpsxKernel` / OPSX router.

1. 删除 `Status List -> full warmup` 的依赖。Status List 只做 change-id inventory 与每 Change 的
   typed Status，并与已在运行的单 Change Status Work 合并。
2. Schema、templates、Apply Instructions、artifact instructions/output 是独立 lazy Work；只有相应
   页面/操作需要时启动。后台预热可以填充低优先级缓存，但不得占住首屏的 CLI 配额。
3. 对每个 CLI leaf 保留原始 stdout/stderr、exit、diagnostics、Store selector 和 root provenance；
   缓存保存的是该完整证据 envelope，不是裸解析 JSON。

精准红例：慢 Apply/Artifact Instructions 使仅需要 Status 的请求不能首发。

绿例：Status 先到，Apply/Artifact Work 仍可独立完成；恢复 `waitForWarmup()` 必须令该例失败。

#### P6. 指纹缓存与 Worker 只在证明后启用

Production owner: Core projection primitives.

1. 对纯文件投影以 versioned content hash 或受控目录 manifest 作为可验证输入。先测量 hash 本身的
   成本与命中率；无法获得正收益时保持 reactive invalidation + memory snapshot，不强加哈希。
2. 只将 CPU 密集、可取消、无副作用的 Markdown 解析/哈希/聚合交给有界 Worker pool。CLI、Git 和
   reactive filesystem 仍由 I/O scheduler 管理。
3. 持久化缓存必须含 schema/protocol version、完整 input fingerprint、size/age 上限和可审查删除；
   不持久化 raw diagnostics、绝对路径、环境/Store 数据域、认证信息或可写 authority。

精准红例：同路径不同内容或 Root A/B 命中同一个持久化结果。

绿例：内容等价命中、内容/根/版本变化 miss；禁用 hash cache 后功能仍正确但命中断言失败。

#### P7. 分段落地与回归门禁

1. 每个 P1-P6 是独立 PR/changeset slice，先通过 named red/green/mutation evidence 再扩大 gate。
2. 重跑本 Change 的 benchmark，将真实首包数据作为 before/after 报告；不可把单机绝对 ms 作为 CI
   唯一门槛。CI 使用受控慢 leaf 的事件顺序和 single-flight 数量断言。
3. 保持 Static 模式的独立 provider 和不可用类型；不得将 live cache/error/authority 伪造到 SSG。
4. 通过 focused Vitest、checked test fixtures、相关 browser component fixture、format/lint/typecheck；
   owner 最终执行 Dashboard/Changes 手动浏览器走查。

## Capability Impact

### New or Expanded Behavior

- Server 提供带 provenance、generation、阶段和批进度的 Projection Work，支持 single-flight、
  bounded cache、取消、失效和受控后台预热。
- Dashboard 可先渲染稳定 Summary，随后独立接收 Git、趋势和 workflow 数据。
- Changes 可逐批渲染、显示真实进度，并与 Status/详情/Apply 的按需投影解耦。
- OPSX Status List 成为最小需求投影，不再隐式要求完整 Kernel warmup。
- 性能 trace 和基准成为非持久、可重复的工程证据，不进入用户通知或产品分析。

### Modified Behavior

- Root Context 当前 snapshot 可以被同 generation 的读取共享，但失效/刷新期间仍不授权 mutation。
- Dashboard 订阅从“每次完整 refresh 后首发”改为“已验证 snapshot 首发 + 可观察更新”。
- 目录元数据、CLI 结果与纯投影的缓存边界从隐式模块 Map 提升为明确 Server-owned contract。

## Risks and Mitigations

| Risk                                    | Mitigation                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A snapshot 被 B 根/Store/Git scope 错标 | Key 包含 owner generation/binding；A retirement 是发布和缓存写入的共同门。                          |
| 显示连续性误变成 mutation authority     | display freshness 与 `current` authority 分离；真实 mutation owner 在调用前重查 gate。              |
| 单飞隐藏了失败或取消                    | Work 对每个 subscriber 保留取消引用计数；完整 error envelope 终态可见，最后一个订阅者离开才可取消。 |
| Worker/CLI 并发反而拖慢或耗尽资源       | scheduler 分 resource class、预算和优先级；通过基准调参；不使用无界 `Promise.all`。                 |
| 指纹扫描自身更慢或泄露路径/内容         | 先测 hash ROI；只存 versioned digest/受控 metadata；不持久化敏感 evidence。                         |
| 事件过细导致 Web churn                  | batch/coalesce 只用于同一 Work 的非首屏后续更新；首批和终态不延迟。                                 |
| 修复 Status 破坏 CLI evidence 语义      | 每个 lazy Work 保留 typed CLI envelope，使用 checked fixture 覆盖 Store selector、诊断和 exit。     |
| 静态页面被 live cache 改写              | Static provider 不接入 Work authority；以独立 unavailable/static contract 测试。                    |

## Verification Strategy

```text
source unit        -> Work key / cache / cancellation / retirement / scheduler
server integration -> real Manager + typed CLI fixture + tRPC event order
web unit           -> region-level unknown/snapshot/updating/error and batch rows
component fixture  -> progressive Dashboard/Changes composition
owner walkthrough  -> final end-to-end browser acceptance
```

- 每个 package 先记录生产 owner、精准红例、绿例；red 必须在当前固定点因命名原因失败。
- 对 Root retirement、single-flight、batch emission、Status lazy dependency 分别删除唯一转移，证明
  mutation resistance；不可用 disabled button 或手工调用下游函数代替。
- 受控 fixture 注入慢 Git、慢 Status、慢 Apply、慢 Change row，并断言不相关稳定 payload 的先到顺序。
- 真实 tRPC 基准继续运行 `packages/server/bench/*.bench.ts`；报告 input inventory、CLI 版本、命令和
  样本，比较 phase 分布而非只写“感觉更快”。
- 每个 TypeScript fixture 都进入检查型 typecheck，禁止 `as any`、伪造 non-null、压制注释或为测试
  放宽生产协议。
- 涉及 Web 的 slice 运行相关 Web unit/Storybook fixture；最终手工 Dashboard/Changes 浏览器走查由
  owner 完成，agent 不以自动化结果替代验收。
