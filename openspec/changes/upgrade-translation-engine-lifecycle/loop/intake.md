## User Input

- Implement the plan.
- 最好使用 openspect 进行记录和推进
- 给我一份完整的工作计划，我的目的是一步到位，并且这个计划要包含 BDD 驱动测试，能够通过多轮迭代自行 review 来逼近我们原定的计划而不产生偏移。
- 当前 `local-ct2` 已经初步对接完成，但 review 发现需要一次性补齐：
  - `ctranslate2` native runtime 发布链路闭环
  - 安装检测与运行可用性检测分层
  - `browser` / `local` / `local-ct2` 统一生命周期平台
  - Settings Translation UI 的安装 gate、日志流、标准流程自动切换
  - 随着 engine 增长的 descriptor/registry 抽象升级

## Objective Scope

- 以 `6417ec9 feat(translation): add local ct2 engine` 为实现基线，升级翻译引擎平台法则。
- 建立统一的 translation engine lifecycle contract，明确区分：
  - runtime dependency install
  - runtime health probe
  - model asset readiness
- 将 `browser`、`local`、`local-ct2` 接入同一套 descriptor-driven registry 和 install/probe orchestration。
- 将 Settings Translation 安装入口升级为共享 install gate：
  - 需要安装时显示 icon-button + description
  - 安装开始后 description 切换为 `pre` 日志卡片
  - 安装完成后自动进入现有标准卡片流程
- 用 BDD 驱动测试覆盖 install/probe/asset/page-flow 行为，并在实现过程中通过多轮 self-review 对照 acceptance matrix 收敛。
- 使用 OpenSpec loop artifacts 持续记录 intake、research-plan、implementation、checkpoints。

## Non-Goals

- 不在本轮引入新的翻译 engine。
- 不把 native runtime profile 失败特判写成 UI fallback 胶水。
- 不改变 browser translator 的浏览器能力模型本身，只将其接入统一 lifecycle 平台。
- 不在本轮执行 release 发布动作。
- 不为了兼容旧的单字段 `installStatus` 语义而保留第二套平台 truth。

## Acceptance Boundary

- `browser`、`local`、`local-ct2` 三个 engine 都通过统一 lifecycle contract 暴露状态。
- install gate 仅在 dependency 或 runtime health 未就绪时显示；runtime ready 后才显示 engine-specific 标准卡片。
- `local-ct2` 的 dependency detect 不再只以 `npm list` 为最终 truth；必须补 runtime health probe。
- `openspecui` 作为最终 runtime host 持有 `ctranslate2` optional dependency 语义，server 只是开发态宿主。
- `ctranslate2` 发布形态与 loader 策略一致，不再出现“声明支持多平台但发布包只含本机 binary”的不闭合状态。
- `settings-translation-panel` 的 shared 层不再新增 `engineId === 'local' | 'local-ct2'` 分支来表达生命周期或安装流程。
- BDD 测试覆盖至少这些场景：
  - browser 跳过安装 gate
  - local/local-ct2 缺依赖时出现 gate
  - install log streaming 与自动贴底滚动
  - dependency installed 但 runtime probe failed 时继续挡住标准卡片
  - runtime ready 后自动进入标准 engine panel
  - managed-local asset missing / ready 对 page-flow 和 smoke test 的影响
- 实现期间每一轮关键改动都同步更新 `loop/implementation.md` 和 `loop/checkpoints.md`，避免与原计划偏移。
