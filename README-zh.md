# OpenSpec UI

[English](./README.md) | [中文](./README-zh.md)

OpenSpecUI 是 OpenSpec 工作流的可视化 Web 界面（支持实时模式与静态导出）。

## 版本兼容矩阵

| OpenSpecUI        | 需要的 OpenSpec CLI |
| ----------------- | ------------------- |
| `@latest` / `@^2` | `>=1.2.0 <2`        |
| `@^1`             | `>=1.0.0 <1.2.0`    |

历史文档：

- 1.x：[`README-1.x.md`](./README-1.x.md)
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

## OpenSpec 1.2 说明

- OpenSpecUI 2.x 需要 OpenSpec CLI `>=1.2.0`。
- 如果本地 CLI 版本过低，界面会显示 `OpenSpec CLI Required` 并阻断核心操作，直到升级。
- 默认工作流建议为 `/opsx:propose`（快速路径）。
- 可在 **Settings → OpenSpec 1.2 Profile & Sync** 查看 profile/workflow 同步状态。

升级 CLI：

```bash
npm install -g @fission-ai/openspec@latest
```

## 常用流程

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

- 规格/变更/任务 Dashboard
- Config/Schema 浏览与编辑
- Change Action 对应的 OPSX Compose
- 多标签 PTY 终端（xterm + ghostty-web）
- 动态与静态模式搜索
- 可部署的静态快照导出
