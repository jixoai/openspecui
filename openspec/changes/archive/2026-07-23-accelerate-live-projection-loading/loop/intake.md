<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Preserve the owner's observed live-page loading problem without prematurely naming one cause.
2. Bound this Change to evidence-backed projection latency and its systemic remedy.
3. Preserve correctness, provenance, and authority contracts while performance work is planned.
4. Define the implementation and acceptance boundary for the performance loop.

Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
-->

## User Input

> 现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。
> 请你深入调查，给出一份持有客观证据的调查报告，并给出“系统性的解决方案”，并将它整理成 openspec change
>
> 1. 注意：本目录中哟其它正在进行中的开发工作，这些不会影响你调查，但你尽量不要干扰到这些工作
> 2. 建议：因为需要客观证据，你可以编写一些 `*.bench.ts` 文件来验证客观问题所在，或者测试的你的解决方案
> 3. 重点：关于系统性的解决方案，可以考虑融合以下方案，其中包括且不限于：
>    1. 接口拆分：将一个聚合接口拆分成多个，页面组件收到哪个数据就立刻展示哪个数据
>    2. 数组流式加载：使用 mapReduce 理念，比如将列表数据的处理改成流式的，前端既可以知道目前的状态是未完成或者有明确的进度，同时界面上也可同步显示一些
>    3. 单体流式加载：将一个长时请求任务拆分成多个阶段，目的是尽可能快地显示部分稳定下来的内容。
>    4. 增量计算：如果某一项长时任务的计算可以做到“幂等”，比如它的输入是依赖一些“文件”，那么我们可以认为可以把文件的计算成 hash 作为一个稳定的“输入”，从而实现幂等计算的缓存依据
>    5. 使用多线程、内存缓存技术
>    6. 以上这些技术都可以封装成一套高度抽象的接口（函数编程），来实现全自动化的复合型的性能优化，将它定义成“系统性的解决方案”

## Objective Scope

本 Change 定义 OpenSpecUI Live Project Web 的投影加载性能契约，先覆盖 Dashboard、Changes 及其共享的 Root Context、OPSX、订阅与缓存链路，再把可复用的优化模型推广给其它投影。

```text
browser route
  -> subscription first payload
       -> Root Context acquisition
       -> projection work graph
            -> file / CLI / Git leaves
       -> cache-or-stage event
  -> independently rendered page regions
```

实施必须同时建立以下事实：

- 生产路径有单调时钟的阶段计量，能够区分传输建立、Root 获取、缓存命中、叶子工作、聚合与首个可渲染 payload；不从 Spinner 文案推断性能。
- 同一 Server、同一有效 Root 身份、同一投影输入的并发读取共享一次进行中的工作；已验证快照可立即作为显示数据，而非重复阻塞式读取。
- Dashboard 将稳定概要、Git 快照、趋势/统计、OPSX Schema/Status 等不同稳定性和成本的事实拆为独立投影，页面收到某块即显示该块。
- Changes 行投影不等待工作流 Status；较重的逐 Change 工作以可取消、可恢复、带进度的批流传输，并允许已完成的行先显示。
- 可以由文件/目录内容指纹证明等价输入的纯投影，使用有界内存缓存；持久化缓存只用于经审查的不可执行、非敏感、可重验内容。
- CPU 密集的解析、哈希或聚合在测量证明是瓶颈后才能移动到受限 Worker 池；I/O/CLI 工作不得靠无限并发伪装成多线程优化。

## Non-Goals

- 不在本 Change 中把所有 Loading 合并为一个状态，或以隐藏 Loading 伪造更快的系统。
- 不放松 Root Context 当前性、Root/Git binding token、Store/Reference provenance、Root action lock、错误可见性或 WebSocket 生命周期约束。
- 不把浏览器本地缓存当作事实源、不缓存可写权限、不让过期数据授权 mutation，也不把服务端推送改成浏览器拥有的状态数据库。
- 不以全局磁盘扫描、无限 TTL、无限 Worker/CLI 并发、静默重试或无界队列实现“缓存”。
- 不在调查/规划提交中修改现有 1.6 适配实现、迁移旧协议，或触碰其它正在进行的 Change。
- 不把代理执行的 Vitest、基准或组件夹具称作最终浏览器验收；最终端到端走查仍由 owner 执行。

## Acceptance Boundary

本 Change 达到可实施状态，当且仅当：

- 调查报告记录当前工作区、命令、输入规模、首包/阶段时延、超时与失败语义，并区分真实生产路径、受控基准与源代码结构证据。
- 系统方案定义一个类型安全的投影工作协议，明确输入指纹、Root/投影身份、缓存状态、阶段/批事件、取消、失效、错误与 authority 的关系。
- Dashboard、Changes、Root Context 和 OPSX 各自有独立 owner、精准红例、绿例、mutation-resistance 目标与停止条件；不得把它们合并为一个大修复。
- 每一项缓存或共享工作都有显式失效来源，且 A -> B Root/Store/Binding 变化不能复用、标记或授权 A 的结果。
- 实施任务按共享基础设施、页面投影、增量/Worker 优化、验证与发布拆分，能够由 worker 直接执行而不需要重新设计方案。
- `openspec status --change accelerate-live-projection-loading` 显示全部 apply-required 工件完成，且 Change 校验通过。
