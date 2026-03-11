## User Input

- 我们的 pnpm dev 得把 website 加入支持，默认不启动
- pnpm release 也要支持 cf deploy. 注意 app 项目是比较特殊的，它依赖于 www 项目的发布，发布之后从 npm 去下载 dist 才能进行部署，所以比较特殊。因此 pnpm release 的顺序要做好，它需要分多步，第一步是关于 www/server/core/cli 等 核心的发布。然后是关于 app 的构建与发布，最后是关于 cf-deploy 的部署（如果有变化按需部署），因为比较复杂，我们需要引入良好的 pnpm release 体验。参考 pnpm dev使用 opentui，我们可以参考多 Tabs 的逻辑，实现多 step 的release

## Objective Scope

- 在现有 `scripts/dev-tui.tsx` 的任务面板中新增 `website` 开发任务，并保持其默认不自动启动。
- 将根级 `pnpm release` 从当前的单命令发布升级为基于 OpenTUI 的多步骤发布编排器。
- 在发布编排器中显式实现核心包发布、npm 可见性等待、`@openspecui/app` 构建、以及 Cloudflare Pages 部署的顺序控制。
- 为 `website` 与 `app` 引入按需部署判断，避免每次 release 都无条件做 Pages deploy。
- 保持 `pnpm changeversion` 作为独立前置流程，`pnpm release` 只处理 changeversion 合并之后的正式发布与部署。

## Non-Goals

- 不在本 loop 内改动 `changeset` / `changeversion` 的核心语义或 PR 自动化流程。
- 不在本 loop 内重构 `@openspecui/app` 的 hosted bundle 构建来源，仍保持从 npm tarball 提取 `package/web`。
- 不引入新的 CI workflow；本 loop 只改本地/管理者使用的 `dev` 与 `release` 体验。
- 不实现 npm publish 失败后的自动回滚。

## Acceptance Boundary

- `pnpm dev` 的首页任务列表中出现 `website`，且默认不自动启动，能够像现有可选任务一样手动启动并查看日志。
- `pnpm release` 启动后进入 OpenTUI 多步骤界面，清晰展示每一步的状态与日志，而不是只输出纯文本。
- 发布顺序固定为：preflight -> 核心发布 -> npm 就绪等待（如需要） -> app 构建（如需要） -> Cloudflare deploy（按需）。
- 当 release 只影响部分目标时，编排器能明确跳过不需要的 deploy step，并在界面和最终总结中说明原因。
- `@openspecui/app` 的构建绝不早于对应 npm 版本可见之前执行。
- 任一步骤失败时，后续步骤停止，界面保留失败状态与日志，不自动继续其它步骤。
