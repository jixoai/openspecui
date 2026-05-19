## User Input

- 后续需要将整个项目的 vite 从 7 升级到 8。

## Objective Scope

- 评估并执行本仓库从 Vite 7 升级到 Vite 8 的完整方案。
- 覆盖所有直接依赖 Vite 的子项目与相关插件链路，包括 `packages/app`、`packages/web`、`packages/website`、`packages/xterm-input-panel`。
- 识别 Vite 8 对本仓库的配置、构建、测试、Storybook、SSG 与自定义插件的影响，并制定可验证的迁移步骤。

## Non-Goals

- 不在本 loop 中顺手升级与 Vite 8 无直接关系的大版本依赖。
- 不在缺乏官方兼容依据的情况下同时重构现有构建体系。
- 不把 UI、业务功能、Cloudflare 部署体验优化混入本次升级范围。

## Acceptance Boundary

- 明确列出本仓库当前 Vite 相关依赖与配置受 Vite 8 影响的范围。
- 基于官方 Vite 8 资料形成一份可执行、可验证的升级计划。
- 升级计划至少覆盖依赖版本调整、配置兼容点、验证命令和主要风险。
- 后续实现阶段应能据此完成升级，并通过本仓库 CI 等价检查。
