## Research Findings

- 当前平台 contract 只暴露 `TranslationEngineInstallStatus`，状态只有 `installed | installing | not-installed | error`，无法区分 dependency 安装、runtime probe、asset readiness 三层 truth。
- `packages/server/src/translation-engine-service.ts` 里 `local` 与 `local-ct2` 已经有两套近似 installer/detect 逻辑，说明 engine-specific orchestration 正在 shared 层分叉。
- `detectLocalCt2TranslationRuntimeInstallState()` 目前只通过 `npm list --json` 检查 `ctranslate2` 是否出现在 dependency tree 中，不能证明 native binding 可实际加载。
- `packages/ct2-engine/index.js` 是 NAPI-RS 生成的多平台 loader，但 `packages/ct2-engine/package.json` 没有 companion platform package 声明；当前 `npm pack --dry-run` 只包含 `index.darwin-arm64.node`，发布链路不闭合。
- `resolveRuntimeHostPackageContext()` 已经优先选择 `openspecui` 而不是 `@openspecui/server`，这与最终 runtime host 的产品法则一致，可以复用。
- `packages/web/src/routes/settings-translation-panel.tsx` 已经把 `local` 与 `local-ct2` 收敛为 `ManagedLocalTranslationEngineId`，但 install flow、文案、catalog/query、smoke text 等仍然大量依赖条件分支。
- `packages/server/src/local-model-asset-service.ts` 与 `packages/server/src/ct2-model-asset-service.ts` 共享大量相同生命周期职责，但当前仍是两份平行服务。
- 当前 repo 已有 focused tests 覆盖 translator manifests、runtime package manager、translation engine service、settings translation panel、managed-local page-flow，可直接扩展成 BDD acceptance matrix。
- OpenSpec 当前没有 active change，默认 schema 为 `opsx-collab-pr-loop`，适合把本轮实现、BDD、自 review、PR gate 和 archive gate 同步记录。

## Decision & Plan (For Approval)

- 先升级 `core` contract，再迁移 `server` orchestration，最后重构 `web` install gate 和 managed-local panel；顺序固定为 `core -> server -> web -> tests -> self-review`。
- 建立新的 lifecycle contract：
  - `dependency`: `installed | installing | missing | error | not-applicable`
  - `runtime`: `ready | probing | failed | error | not-applicable`
  - `assets`: `ready | missing | downloading | error | not-applicable`
- 保留 install stream，但 install 完成后必须自动执行 runtime probe，并把最终 lifecycle 一并返回给 UI。
- 引入 descriptor-driven registry，descriptor 至少定义：
  - engine manifest/meta
  - lifecycle classification
  - runtime host dependency package name/range
  - dependency detect/install
  - runtime probe
  - translator factory loader
  - managed-local UI metadata
- `browser` 作为 `not-applicable` dependency/runtime install atom，天然跳过 install gate。
- `local` 与 `local-ct2` 作为 `managed-local` engines 统一走 shared lifecycle gate，但保留各自的 detect/install/probe/catalog/asset adapter。
- 先不强行把两套 asset service 全量重写为一个文件，但必须抽出 shared contract 和 shared helper，让后续 engine 增长时不再复制 shared 规则。
- `ctranslate2` 发布法则调整为“根包 + companion platform packages”的显式模型：
  - 根包保留 loader
  - 根包显式声明 platform optional dependencies
  - 当前未支持的平台必须显式 unsupported，而不是假装可用
- 用 acceptance matrix 驱动 BDD：
  - 先写 failing tests
  - 再落 contract/orchestration/UI
  - 每轮实现后做 Spec Drift / Platform Law / BDD / Runtime Publish 四类 self-review

## Capability Impact

### New or Expanded Behavior

- Translation engine platform 拥有显式 lifecycle truth，而不再把安装和可运行性混成一个状态。
- Settings Translation install gate 在 dependency missing、runtime failed、runtime probing 时都能给出准确用户态。
- `local-ct2` 能在依赖安装后自动进行 runtime health probe，而不是等用户第一次翻译时才炸。
- BDD acceptance matrix 与 OpenSpec loop artifacts 成为实现过程中的唯一真相源。

### Modified Behavior

- `TranslationEngineInstallStatus` 从单层状态升级为多层 lifecycle status。
- `translationEnginesRouter.getInstallStatus/install/installStream` 返回 shared lifecycle shape，而不是旧的 install-only shape。
- Web install flow 不再把 `installed` 当作“可以展示标准卡片”的唯一条件。
- `ctranslate2` 的发布包策略从本地构建产物驱动，升级为显式 multi-platform distribution law。

## Risks and Mitigations

- 风险：lifecycle contract 改动会影响 server/web 多处调用。
  缓解：先在 `core` 增加新 schema 与 helper，测试先改成 acceptance matrix，再逐层迁移，最后删除旧字段引用。

- 风险：`ctranslate2` 发布链路修复会牵涉 package manager / publish scripts。
  缓解：先以 pack dry-run + manifest normalization 保证根包策略闭合；如 companion packages 本轮无法全量自动发布，至少先把 root manifest、README、tests、unsupported truth 纠正到一致。

- 风险：shared asset service 抽象过度，拖慢 lifecycle 平台升级。
  缓解：本轮只抽 shared contract、helper 和 adapter 边界，不追求一次性把 1700+ 行服务完全合并。

- 风险：Settings Translation 大文件改动过大。
  缓解：先抽 install gate/descriptor copy/shared query helpers，再在同文件内收敛逻辑；如仍过大，再在用户允许范围内拆组件。

- 风险：BDD 自 review 只变成口头流程。
  缓解：把 acceptance matrix 直接写进 tests 和 `loop/checkpoints.md`，每轮验证都对应具体命令和场景。

## Verification Strategy

- `core`
  - `translator.test.ts`: lifecycle descriptor truths、managed-local 分类、manifest meta
  - `runtime-package-manager.test.ts`: npm/pnpm/yarn/bun/deno/vp install command laws
- `server`
  - `translation-engine-service.test.ts`: browser bypass、local/local-ct2 dependency missing、runtime probe success/failure、gate lifecycle sequencing
  - `runtime-package-host.test.ts`: runtime host still resolves to `openspecui`
  - `ct2-engine` pack dry-run verification: published contents and manifest expectations
- `web`
  - `settings.test.tsx`: install gate visibility、install logs、runtime fail gate、runtime ready handoff、browser no-gate path
  - `translate-service.test.ts` and `translate-service-status.ts`: managed-local asset missing vs ready page-flow
- Verification commands
  - `pnpm --filter @openspecui/core exec vitest run src/translator.test.ts src/runtime-package-manager.test.ts`
  - `pnpm --filter @openspecui/server exec vitest run src/runtime-package-host.test.ts src/translation-engine-service.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx src/lib/translate-service.test.ts src/lib/translate-service-status.test.ts --project unit`
  - `pnpm --filter ctranslate2 exec vitest run test/smoke.test.ts`
  - `cd packages/ct2-engine && npm pack --dry-run`
