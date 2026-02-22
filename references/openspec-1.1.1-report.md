# OpenSpec 0.16.0 → 1.1.1 调研报告

> 基于 `references/openspec`（当前 tag：v1.1.1）与本项目现有代码与 specs 分析生成。  
> 调研时间：2026-02-04

## 1. 0.16.0 至 1.1.1 变更概览（官方 CHANGELOG 摘要）

### 0.17.0

- 新增 `openspec config` 命令（全局配置，XDG 支持）
- 新增 Oh‑my‑zsh 补全
- 修复 pre‑commit hang（动态 import inquirer）

### 0.17.1

- 修复 `config` 命令引起的 pre‑commit hook 卡死问题

### 0.17.2

- 修复 `validate --no-interactive` 在 CI / hook 中的 spinner hang

### 0.18.0

- 引入 OPSX 实验性工作流命令：`/opsx:ff`, `/opsx:sync`, `/opsx:archive`
- 引入 artifact graph + schema templates 体系
- 引入 `.openspec.yaml`（change 元数据）
- 引入 Agent Skills（取代旧散落指令）

### 0.19.0

- 新增 `/opsx:explore`
- 新增 Continue IDE 支持
- 新增 shell completion（bash/fish/powershell）
- 新增可选匿名遥测（可通过环境变量关闭）

### 0.20.0

- 新增 `/opsx:verify`
- 修复 vitest 进程风暴

### 0.21.0

- 新增 `openspec feedback`
- 新增 Nix flake 支持
- `opsx apply` 变更推断优化

### 0.22.0

- 新增项目级配置 `openspec/config.yaml`
- 新增项目本地 schemas：`openspec/schemas/`
- 新增 `openspec schema` 管理命令（list/show/export/validate）

### 0.23.0

- 新增 `/opsx:bulk-archive`
- init 简化为默认值+注释

### 1.0.0（OPSX 正式版本）

- **Breaking**：移除旧 `/openspec:*` 命令
- **Breaking**：不再生成工具专属指令文件（`CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `project.md`）
- **核心变化**：动态 instructions（context + rules + template），基于 artifact graph
- **新增命令**：`/opsx:new`, `/opsx:continue`, `/opsx:ff`, `/opsx:apply`, `/opsx:verify`, `/opsx:sync`, `/opsx:archive`, `/opsx:bulk-archive`, `/opsx:onboard`
- **新增特性**：自定义 schema（`openspec/schemas/`）

### 1.0.1

- 修复 onboarding 文档的 archive 路径示例

### 1.0.2

- 强调 spec 命名规范：`specs/<capability>/spec.md`
- 强调 tasks checkbox 格式必须 `- [ ]`

### 1.1.0

- 修复 Codex 全局路径解析
- 归档操作支持跨设备/权限失败时 fallback copy+remove
- workflow 提示增加 slash command hints
- 修复 Windsurf workflows 目录路径

### 1.1.1

- 修复 OpenCode 命令引用格式（`/opsx-` hyphen）

---

## 2. 对 OpenSpecUI 的影响（以 1.1.\* 为唯一基线）

> 低版本兼容不再考虑，统一要求 CLI >= 1.1.x。

### 2.1 必须对齐的核心变化

- **OPSX 工作流成为唯一模型**：artifact graph / instructions / templates 成为事实来源
- **Agent Skills 取代旧指令文件**：工具检测逻辑必须转为 skillsDir 体系
- **配置/Schema 体系成为核心**：`openspec/config.yaml` + `openspec/schemas/` + `.openspec.yaml`
- **命令体系彻底切换**：仅使用 `/opsx:*`

### 2.2 OpenSpecUI 的官方对齐原则

1. **CLI 真相化**：UI 不再解析业务语义；只渲染 CLI JSON 输出
2. **OPSX 视图中心化**：Change 视图以 artifact graph 为核心
3. **Schema 与配置显性化**：配置与 schema 视图为一级能力
4. **Skills-only 工具检测**：不再识别旧 slash command 文件

---

## 3. 对 OpenSpecUI 的落地要求（Spec 化）

本项目已将核心需求写入以下 specs（作为后续实现依据）：

- `openspec/specs/opsx-workflow-ui/spec.md`
  - CLI 驱动的 status / instructions / errors / refresh / 1.1.x 基线

- `openspec/specs/openspec-cli-integration/spec.md`
  - CLI 发现、版本校验、执行与流式输出

- `openspec/specs/reactive-file-system/spec.md`
  - 文件监听与 reactive 查询/订阅要求

- `openspec/specs/opsx-ui-views/spec.md`
  - Dashboard / Change / Schema / Settings 视图与 OPSX action panel

- `openspec/specs/opsx-artifact-editor/spec.md`
  - 模板优先编辑、依赖阻塞、输出路径保存

- `openspec/specs/opsx-terminal-panel/spec.md`
  - 终端输出与命令历史交互

static export 作为 OpenSpecUI 独立能力已保留：

- `openspec/specs/build-pipeline/spec.md`
- `openspec/specs/cli-commands/spec.md`
- `openspec/specs/web-rendering/spec.md`

---

## 4. 结论

- OpenSpec 1.1.\* 的核心在于 OPSX + CLI 动态指令 + skills 体系。
- OpenSpecUI 的正确路径是：**完全依赖 CLI 输出作为事实来源**，将 UI 变成 OPSX 的最佳实践可视化入口。
- 本项目 specs 已完整覆盖该方向，可直接进入编码实现阶段。
