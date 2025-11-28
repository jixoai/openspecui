# OpenSpec UI

[English](#english) | [中文](#中文)

---

## English

A visual web interface for spec-driven development with OpenSpec.

### Features

- **Dashboard** - Overview of specs, changes, and task progress
- **Spec Management** - View and edit specification documents
- **Change Proposals** - Track change proposals with tasks and deltas
- **Task Tracking** - Click to toggle task completion status
- **Realtime Updates** - WebSocket-based live updates when files change
- **AI Integration** - Review, translate, and suggest improvements (API & ACP)

### Quick Start

```bash
# Install globally
npm install -g openspecui

# Run in your project directory
openspecui

# Or specify a directory
openspecui ./my-project
```

The UI will open at `http://localhost:3100`.

### CLI Options

```
Usage: openspecui [options] [project-dir]

Options:
  -p, --port <port>   Port to run the server on (default: 3100)
  -d, --dir <path>    Project directory containing openspec/ (default: cwd)
  --no-open           Don't automatically open the browser
  -h, --help          Show help message
```

### Project Structure

OpenSpec UI expects the following directory structure:

```
your-project/
└── openspec/
    ├── project.md          # Project overview
    ├── AGENTS.md           # AI agent instructions
    ├── specs/              # Specification documents
    │   └── {spec-id}/
    │       └── spec.md
    └── changes/            # Change proposals
        ├── {change-id}/
        │   ├── proposal.md
        │   └── tasks.md
        └── archive/        # Archived changes
```

### Development

```bash
# Clone the repository
git clone https://github.com/jixoai-labs/openspecui.git
cd openspecui

# Install dependencies
pnpm install

# Build all packages
pnpm build:packages

# Start development servers
pnpm dev
```

### Packages

| Package | Description |
|---------|-------------|
| `openspecui` | CLI tool and bundled web UI |
| `@openspecui/core` | File adapter, parser, validator, and watcher |
| `@openspecui/server` | tRPC HTTP/WebSocket server |
| `@openspecui/ai-provider` | AI provider abstraction (API & ACP) |
| `@openspecui/web` | React web application |

### Tech Stack

- **Frontend**: React 19, TanStack Router, TanStack Query, Tailwind CSS v4
- **Backend**: Hono, tRPC v11, WebSocket
- **Build**: pnpm workspaces, Vite, tsdown
- **Type Safety**: TypeScript, Zod

### License

MIT

---

## 中文

OpenSpec 规范驱动开发的可视化 Web 界面。

### 功能特性

- **仪表盘** - 规范、变更和任务进度概览
- **规范管理** - 查看和编辑规范文档
- **变更提案** - 跟踪变更提案及其任务和增量
- **任务跟踪** - 点击切换任务完成状态
- **实时更新** - 基于 WebSocket 的文件变更实时更新
- **AI 集成** - 审查、翻译和改进建议（支持 API 和 ACP）

### 快速开始

```bash
# 全局安装
npm install -g openspecui

# 在项目目录中运行
openspecui

# 或指定目录
openspecui ./my-project
```

界面将在 `http://localhost:3100` 打开。

### 命令行选项

```
用法: openspecui [选项] [项目目录]

选项:
  -p, --port <端口>   服务器端口（默认: 3100）
  -d, --dir <路径>    包含 openspec/ 的项目目录（默认: 当前目录）
  --no-open           不自动打开浏览器
  -h, --help          显示帮助信息
```

### 项目结构

OpenSpec UI 期望以下目录结构：

```
your-project/
└── openspec/
    ├── project.md          # 项目概述
    ├── AGENTS.md           # AI 代理指令
    ├── specs/              # 规范文档
    │   └── {spec-id}/
    │       └── spec.md
    └── changes/            # 变更提案
        ├── {change-id}/
        │   ├── proposal.md
        │   └── tasks.md
        └── archive/        # 已归档的变更
```

### 开发

```bash
# 克隆仓库
git clone https://github.com/jixoai-labs/openspecui.git
cd openspecui

# 安装依赖
pnpm install

# 构建所有包
pnpm build:packages

# 启动开发服务器
pnpm dev
```

### 包说明

| 包名 | 描述 |
|------|------|
| `openspecui` | CLI 工具和打包的 Web UI |
| `@openspecui/core` | 文件适配器、解析器、验证器和监视器 |
| `@openspecui/server` | tRPC HTTP/WebSocket 服务器 |
| `@openspecui/ai-provider` | AI 提供者抽象层（API 和 ACP） |
| `@openspecui/web` | React Web 应用 |

### 技术栈

- **前端**: React 19, TanStack Router, TanStack Query, Tailwind CSS v4
- **后端**: Hono, tRPC v11, WebSocket
- **构建**: pnpm workspaces, Vite, tsdown
- **类型安全**: TypeScript, Zod

### 许可证

MIT
