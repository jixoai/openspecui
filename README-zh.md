# OpenSpec UI

[English](./README.md) | [中文](./README-zh.md)

OpenSpecUI 是 OpenSpec 工作流的 Web 界面（动态模式 + 静态导出）。

## 版本兼容关系

| OpenSpecUI        | OpenSpec CLI 线                                |
| ----------------- | ---------------------------------------------- |
| `@latest` / `@^3` | 当前：`>=1.3.0 <1.4.0`；接受：`>=1.2.0 <1.4.0` |
| `@^2`             | `>=1.2.0 <1.3.0`                               |
| `@^1`             | `>=1.0.0 <1.2.0`                               |

OpenSpecUI 的 major 版本跟随 OpenSpec CLI 的 minor 线。OpenSpecUI 3.x 面向 OpenSpec CLI
1.3.x，并向后兼容 1.2.x 项目。OpenSpecUI 2.x 不向前兼容 OpenSpec CLI 1.3.x。

历史文档：

- 1.2：[`README-1.2.0.md`](./README-1.2.0.md)
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

默认地址：`http://localhost:3100`。

## OpenSpec 1.3 说明

- OpenSpecUI 3.x 面向 OpenSpec CLI `>=1.3.0 <1.4.0`。
- OpenSpec CLI `>=1.2.0 <1.3.0` 在 3.x 中作为 legacy-compatible runtime 被接受。
- 如果 CLI 不在 `>=1.2.0 <1.4.0` 范围内，界面会显示 `OpenSpec CLI Required` 并阻断核心操作，直到升级。
- 可在 **Settings → OpenSpec Profile & Sync** 查看 profile/workflow 同步状态。
- OpenSpec CLI 1.3 新增 Bob Shell、ForgeCode、Junie、Lingma，改进 GitHub Copilot 检测，并把 OpenCode 命令目录切换到 `.opencode/commands/`。

升级 CLI：

```bash
npm install -g @fission-ai/openspec@latest
```

## 常见流程

### 启动服务

```bash
openspecui
openspecui ./my-project
openspecui --port 3200
```

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

## 核心能力

- specs/changes/tasks 状态仪表盘
- Config/Schema 查看与编辑
- 用于 change action 的 OPSX compose 面板
- 多标签 PTY 终端（xterm + ghostty-web）
- 动态模式与静态模式搜索
- 用于文档托管的静态快照导出
