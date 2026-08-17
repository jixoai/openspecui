<!--
Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
1. 说明当前 OpenSpec 兼容线与项目工作流。
2. 说明 serve、App daemon、Direct Web 与静态导出命令。
3. 说明项目 Hooks，同时保持 OpenSpec CLI 的事实权威。

原始需求（2026-07-29）："补充 openspecui --web == openspecui serve --web；README 文档需要补充这些命令的介绍。"
原始需求（2026-08-01）："v7不兼容1.6.x，明确要求必须使用 v1.7.x。"
-->

# OpenSpec UI

[English](./README.md) | [中文](./README-zh.md)

OpenSpecUI 是 OpenSpec 工作流的 Web 界面（动态模式 + 静态导出）。

## 版本兼容关系

| OpenSpecUI        | OpenSpec CLI 线                                |
| ----------------- | ---------------------------------------------- |
| `@latest` / `@^7` | `>=1.7.0 <1.8.0`                               |
| `@^6`             | 当前：`>=1.6.0 <1.7.0`；兼容：`>=1.7.0 <1.8.0` |
| `@^5`             | 当前：`>=1.5.0 <1.6.0`；接受：`>=1.4.0 <1.6.0` |
| `@^4`             | 当前：`>=1.4.0 <1.5.0`；接受：`>=1.3.0 <1.5.0` |
| `@^3`             | `>=1.3.0 <1.4.0`                               |
| `@^2`             | `>=1.2.0 <1.3.0`                               |
| `@^1`             | `>=1.0.0 <1.2.0`                               |

OpenSpecUI 的 major 版本通常跟随 OpenSpec CLI 的 minor 线。OpenSpecUI 7 仅适配 OpenSpec CLI 1.7.x。
OpenSpecUI 6.1 则保留为历史 1.6.x 产品线，并维持其临时的 1.7 兼容桥接。

历史文档：

- 1.6：[`README-zh-1.6.0.md`](./README-zh-1.6.0.md)
- 1.3：[`README-zh-1.3.0.md`](./README-zh-1.3.0.md)
- 1.2：[`README-zh-1.2.0.md`](./README-zh-1.2.0.md)
- 1.x UI / 1.2 之前 CLI 线：[`README-zh-1.x.md`](./README-zh-1.x.md)
- 0.16：[`README-0.16.0.md`](./README-0.16.0.md)

## 快速开始

```bash
# 推荐：不全局安装直接运行
npx openspecui@latest
bunx openspecui@latest

# 可选：全局安装
npm install -g openspecui
openspecui
```

选择 Direct Project Web 时，默认地址为 `http://localhost:3100`。

## OpenSpec CLI 兼容性

- OpenSpecUI 7 要求 OpenSpec CLI `>=1.7.0 <1.8.0`。
- OpenSpec CLI 1.6.x、更旧的 CLI 线及 CLI `>=1.8.0` 均不受 OpenSpecUI 7 支持，并会被默认阻断。
- 若不兼容的 CLI 可执行文件仍然存在，版本不匹配对话框会提供 **Skip version check**。该绕过只在当前页面运行期有效，刷新或重新打开后清除，也不构成兼容性承诺。

升级 CLI：

```bash
npm install -g @fission-ai/openspec@latest
```

## 常见流程

### 启动项目服务

```bash
openspecui
openspecui ./my-project
openspecui serve ./my-project
openspecui --port 3200
```

裸命令是 `serve` 的缩写，每个 `serve` 进程只负责自己的项目 Server。若 App daemon 已经
运行，项目会被加入它的 **Workspaces**；否则交互式终端会询问
`Start OpenSpecUI App? [Y/n]`，非交互环境则打开 Direct Project Web。

### App daemon 与显式呈现模式

```bash
# 通过本地 App daemon 呈现当前项目（默认使用原生 OpenTray）
openspecui --app
openspecui serve --app

# 打开 Direct Project Web；若 daemon 已运行，同时附加 Workspace
openspecui --web
openspecui serve --web
openspecui serve --no-open

# 只管理用户级 App daemon，不管理项目 Server
openspecui start
openspecui start --web
openspecui stop
openspecui restart
openspecui restart --web
```

daemon 的宿主模式在启动时固定：native 使用保留式 OpenTray 窗口，`--web` 使用
普通 Browser Web 宿主。若重复 `start` 显式请求了另一种模式，请执行 CLI 提示的精确
`restart` 命令。`serve --no-open` 不会询问、启动 daemon、注册 Workspace 或打开浏览器。
带 URL 的 App 模式与项目级 App shell 地址设置已不再支持；daemon 只提供与当前 CLI
同版本打包的 App shell。每个 Workspace 标签都可以请求 daemon 在系统浏览器中打开当前
backend，页面本身不能提交任意 URL。

### 静态导出

```bash
openspecui export -o ./dist
openspecui export -o ./dist --base-path /docs --clean
```

### Nix

```bash
nix run github:jixoai/openspecui -- --help
nix develop
```

## 项目 Hooks

OpenSpecUI 支持从 `openspec/openspecui.hooks.ts` 加载项目级 hooks。
Hooks 刻意放在 `openspec/.openspecui.json` 之外，避免可执行的项目行为污染持久化的 UI 配置。

安装期类型可从 CLI 包导入：

```ts
import type { OnReadDocumentHookV1, OnRunWorkflowHookV2 } from 'openspecui/hooks'
```

### `onReadDocument`

当项目需要为 UI 消费者以不同方式呈现 OpenSpec markdown、又不想改写源文件时，使用 `onReadDocument`。
典型场景包括从其它文件解析需求 ID、为读者翻译 markdown，或为搜索/导出补充派生上下文。

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { OnReadDocumentHookV1 } from 'openspecui/hooks'

export const onReadDocument: OnReadDocumentHookV1 = async (ctx, read) => {
  const result = await read()
  if (ctx.document.kind !== 'spec') return result

  const glossaryPath = join(ctx.projectDir, 'openspec', 'glossary.md')
  const glossary = await readFile(glossaryPath, 'utf-8')

  return {
    ...result,
    markdown: `${result.markdown}\n\n---\n\n${glossary}`,
    watchFiles: [glossaryPath],
  }
}
```

`onReadDocument` 在 OpenSpecUI V1 中服务端运行，作用于动态视图、搜索与静态导出的处理后文档读取。
源文件读取保持原始且可审计，因此编辑、校验与源码检查仍使用原始 OpenSpec 文件。

### `onRunWorkflow`

使用 `onRunWorkflow` 在 OpenSpecUI 把最终 OPSX 调用载荷交给 agent 或命令运行器之前进行调整。
OpenSpec CLI 仍是 workflow 状态、指令、schema、校验与归档行为的唯一事实来源。

```ts
import type { OnRunWorkflowHookV2 } from 'openspecui/hooks'

export const onRunWorkflow: OnRunWorkflowHookV2 = async (ctx, run) => {
  const result = await run()
  if (result.kind !== 'agent-prompt') return result

  return {
    ...result,
    text: `${result.text}\n\nPlanning root: ${ctx.target.planningRoot.path}\nProject policy: include security impact in the final summary.`,
  }
}
```

如果 hook 抛错，OpenSpecUI 会回退到默认结果并附上诊断信息，而不是阻断界面。

## 核心能力

- specs/changes/tasks 状态仪表盘
- Config/Schema 查看与编辑
- 用于 change action 的 OPSX compose 面板
- 多标签 PTY 终端（xterm + ghostty-web）
- 动态模式与静态模式搜索
- 用于文档托管的静态快照导出
- 用于文档投影与 OPSX 调用定制的项目级 hooks
