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
- **Static Site Export** - Export the current state as static website to be used in CI
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
Usage: openspecui [command] [options]

Commands:
  openspecui [project-dir]     Start the development server (default)
  openspecui start [project-dir]  Start the development server
  openspecui export            Export as a static website

Start Options:
  -p, --port <port>       Port to run the server on (default: 3100)
  -d, --dir <path>        Project directory containing openspec/
  --no-open               Don't automatically open the browser
  -h, --help              Show help message
  -v, --version           Show version number

Export Options:
  -o, --output <path>     Output directory (required)
  -d, --dir <path>        Project directory containing openspec/
  --base-path <path>      Base path for deployment (default: /)
  --clean                 Clean output directory before export
  --open                  Open exported site in browser after export
```

### Static Export

Export your OpenSpec project as a static website for deployment to GitHub Pages, Netlify, or any static hosting service.

```bash
# Export to a directory (output directory is required)
openspecui export -o ./dist

# Export with long form
openspecui export --output ./my-docs

# Export for subdirectory deployment (automatically normalized)
openspecui export -o ./dist --base-path /docs
# Note: /docs, /docs/, and docs all normalize to /docs/

# Clean output directory before export
openspecui export -o ./dist --clean

# Export from a different project directory
openspecui export -o ./dist --dir ../my-project

# Combine options
openspecui export -o ./dist --base-path /specs --clean
```

The exported site includes:

- Complete data snapshot (data.json)
- All HTML, CSS, JS assets
- Fallback routing for SPA navigation
- Routes manifest for all pages

**Note:** Static exports have limited functionality compared to the live server:

- No real-time file watching
- No task checkbox toggling
- No AI integration features
- Read-only view of the snapshot at export time

#### Test the Static Export Locally

```bash
# Export the site
openspecui export -o ./test-output --clean

# Serve it locally with any static server
cd test-output
python3 -m http.server 8080
# Or: npx http-server -p 8080

# Open in browser
# http://localhost:8080
```

Look for the "📸 Static Snapshot" banner at the top to confirm static mode is active.

#### Deploy to GitHub Pages

```yaml
# .github/workflows/deploy-specs.yml
name: Deploy Specs

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g openspecui
      - run: openspecui export -o ./dist
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

#### Deploy to Subdirectory (e.g., /docs/)

If you're deploying to a subdirectory, use the `--base-path` option:

```bash
# Export with base path
openspecui export -o ./dist --base-path /docs

# The base path is automatically normalized:
# /docs   -> /docs/
# /docs/  -> /docs/
# docs    -> /docs/
```

**GitHub Pages example:**

```yaml
- run: openspecui export -o ./dist --base-path /my-repo
```

**Important:** When using a custom base path:

- All assets and navigation will be prefixed with the base path
- The exported site must be served from that path (e.g., `https://example.com/docs/`)
- Direct URL access will work correctly (e.g., `https://example.com/docs/specs/my-spec`)

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

| Package                   | Description                                  |
| ------------------------- | -------------------------------------------- |
| `openspecui`              | CLI tool and bundled web UI                  |
| `@openspecui/core`        | File adapter, parser, validator, and watcher |
| `@openspecui/server`      | tRPC HTTP/WebSocket server                   |
| `@openspecui/ai-provider` | AI provider abstraction (API & ACP)          |
| `@openspecui/web`         | React web application                        |

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
用法: openspecui [命令] [选项]

命令:
  openspecui [项目目录]     启动开发服务器（默认）
  openspecui start [项目目录]  启动开发服务器
  openspecui export         导出为静态网站

启动选项:
  -p, --port <端口>       服务器端口（默认: 3100）
  -d, --dir <路径>        包含 openspec/ 的项目目录
  --no-open               不自动打开浏览器
  -h, --help              显示帮助信息
  -v, --version           显示版本号

导出选项:
  -o, --output <路径>     输出目录（必需）
  -d, --dir <路径>        包含 openspec/ 的项目目录
  --base-path <路径>      部署的基础路径（默认: /）
  --clean                 导出前清理输出目录
  --open                  导出后在浏览器中打开
```

### 静态导出

将您的 OpenSpec 项目导出为静态网站，可部署到 GitHub Pages、Netlify 或任何静态托管服务。

```bash
# 导出到目录（输出目录为必需参数）
openspecui export -o ./dist

# 使用完整格式
openspecui export --output ./my-docs

# 为子目录部署导出（自动规范化）
openspecui export -o ./dist --base-path /docs
# 注意: /docs, /docs/, 和 docs 都会规范化为 /docs/

# 导出前清理输出目录
openspecui export -o ./dist --clean

# 从不同的项目目录导出
openspecui export -o ./dist --dir ../my-project

# 组合选项
openspecui export -o ./dist --base-path /specs --clean
```

导出的网站包含：

- 完整的数据快照 (data.json)
- 所有 HTML、CSS、JS 资源
- SPA 导航的回退路由
- 所有页面的路由清单

**注意：** 静态导出相比实时服务器功能有限：

- 无实时文件监听
- 无任务复选框切换
- 无 AI 集成功能
- 仅可查看导出时的只读快照

#### 本地测试静态导出

```bash
# 导出网站
openspecui export -o ./test-output --clean

# 使用任何静态服务器本地提供服务
cd test-output
python3 -m http.server 8080
# 或: npx http-server -p 8080

# 在浏览器中打开
# http://localhost:8080
```

查看顶部的 "📸 Static Snapshot" 横幅以确认静态模式已激活。

#### 部署到 GitHub Pages

```yaml
# .github/workflows/deploy-specs.yml
name: Deploy Specs

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g openspecui
      - run: openspecui export -o ./dist
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

#### 部署到子目录（例如 /docs/）

如果要部署到子目录，请使用 `--base-path` 选项：

```bash
# 使用基础路径导出
openspecui export -o ./dist --base-path /docs

# 基础路径会自动规范化：
# /docs   -> /docs/
# /docs/  -> /docs/
# docs    -> /docs/
```

**GitHub Pages 示例：**

```yaml
- run: openspecui export -o ./dist --base-path /my-repo
```

**重要说明：** 使用自定义基础路径时：

- 所有资源和导航都将以基础路径为前缀
- 导出的网站必须从该路径提供服务（例如 `https://example.com/docs/`）
- 直接 URL 访问将正常工作（例如 `https://example.com/docs/specs/my-spec`）

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

| 包名                      | 描述                               |
| ------------------------- | ---------------------------------- |
| `openspecui`              | CLI 工具和打包的 Web UI            |
| `@openspecui/core`        | 文件适配器、解析器、验证器和监视器 |
| `@openspecui/server`      | tRPC HTTP/WebSocket 服务器         |
| `@openspecui/ai-provider` | AI 提供者抽象层（API 和 ACP）      |
| `@openspecui/web`         | React Web 应用                     |

### 技术栈

- **前端**: React 19, TanStack Router, TanStack Query, Tailwind CSS v4
- **后端**: Hono, tRPC v11, WebSocket
- **构建**: pnpm workspaces, Vite, tsdown
- **类型安全**: TypeScript, Zod

### 许可证

MIT
