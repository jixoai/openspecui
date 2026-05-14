## User Input

- 新的任务：
- Primary Button 需要有一个变体：activity
- 参考 Settings>Terminal>Shells 这里的 default。这里语义上还是 Button，但因为已经处于激活状态，所以不是不能点击，而是不需要点击。
- 请封装好，并做好语义化，接着寻找其它可以用的地方。
- 比如我找到 Enable System Notifications 这里的 Enabled。
- 以及 Settings 页面中的各种 Save|Apply 按钮，理论可以使用这个变体。而不是用 disabled
- 所以你再找找，有没有其它的地方可以利用这个变体的。
- 用户后续确认：activity 不应该作为 `variant="activity"`，而应该作为独立状态属性，与 Button variant 正交。
- 用户要求：开始这个任务的 openspec change 的编写和 apply。

## Objective Scope

- 建立共享 Button 原子，承载 primary/secondary/ghost/destructive 等动作意图。
- 在共享 Button 原子上提供独立的 `activity` 状态，表达“动作语义仍在，但当前状态已经达成，所以不需要点击”。
- 将当前明确符合 activity 语义的调用点迁移到共享 Button：
  - `Settings > Terminal > Shells` 当前默认 shell 的 `Default`。
  - `Enable System Notifications` 的 `Enabled`。
  - Settings 页面中基于 dirty 状态禁用的 Save/Apply 按钮。
- 继续搜索相同语义的按钮调用点，迁移适合的页面级 primary action。

## Non-Goals

- 不把所有按钮一次性重构为共享 Button。
- 不改变真实不可执行状态的 disabled 语义，例如 pending、权限不足、运行中、输入非法、静态模式不可写。
- 不调整 Settings 页面布局或视觉系统主题。
- 不引入新的组件库依赖。

## Acceptance Boundary

- 共享 Button API 中 `activity` 与 `variant` 是正交维度。
- `activity` 状态不使用原生 `disabled`，但会阻止无意义的点击触发，并暴露可访问语义。
- 首批目标调用点使用共享 Button 表达 activity，不再用 disabled 表达“已经同步/已经启用/已经默认”。
- 相关行为有 focused unit tests 或 component tests 覆盖。
- OpenSpec checkpoints 与实际实现状态同步。
