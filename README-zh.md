# OpenSpec UI

[English](./README.md) | [中文](./README-zh.md)

![](https://github.com/user-attachments/assets/8814f210-5183-4b63-918a-9cd5be68b70a)

OpenSpec 规范驱动开发的可视化 Web 界面。

### 功能特性

- **仪表盘** - 规范、变更和任务进度概览
- **规范管理** - 查看和编辑规范文档
- **变更提案** - 跟踪变更提案及其任务和增量
- **任务跟踪** - 点击切换任务完成状态
- **实时更新** - 基于 WebSocket 的文件变更实时更新
- **内置终端** - 支持桌面端/移动端的 PTY Web Terminal
- **OPSX Compose** - 从变更动作生成提示词并编辑后发送到终端
- **搜索面板** - 动态模式与静态导出模式都可搜索
- **CLI 执行路径** - 支持 runner 探测与 `execute-path` 配置
- **AI 集成** - 审查、翻译和改进建议（支持 API 和 ACP）

### 快速开始

```bash
# 推荐：不全局安装直接运行（可确保每次使用最新版）
npx openspecui@latest
bunx openspecui@latest

# 在项目目录中运行
openspecui

# 或指定目录
openspecui ./my-project

# 可选：全局安装
npm install -g openspecui

# 使用 Nix Flake 运行
nix run github:jixoai/openspecui -- --help
```

界面将在 `http://localhost:3100` 打开。

### Nix 用法

```bash
# 直接运行 OpenSpecUI
nix run github:jixoai/openspecui -- --help

# 安装到本地 profile
nix profile install github:jixoai/openspecui

# 进入开发环境
nix develop
```

### 使用指南

#### 1) Web Terminal（桌面 + 移动）

- 从导航打开 `Terminal` 页面。
- 终端会话默认是长生命周期，只会在你主动关闭 tab/会话时结束。
- 进程结束后，可以通过关闭动作（包含终端内按键关闭行为）关闭该终端页签。
- 移动端有输入面板/FAB；桌面端也可按需打开同一套输入面板。

#### 2) 在 Change 页面使用 OPSX Compose

- 打开变更页面（`/changes/:changeId`）。
- 点击 `Continue`、`Fast-forward`、`Apply`、`Verify`、`Archive` 任一按钮。
- 会在 PopArea（`/opsx-compose`）打开 Compose 对话框，并自动生成草稿提示词。
- 在 `CodeEditor` 中编辑后可执行：
  - `Send`：选择一个在线终端，将内容写入该 PTY。
  - `Copy`：复制到剪贴板。
  - `Save`：保存到终端输入历史。

#### 3) 响应式搜索（动态 + 静态）

- 桌面端：点击侧边栏 Logo 下方 `Search`。
- 移动端：点击顶部栏搜索图标。
- 搜索在 PopArea（`/search?query=...`）中展示，支持关键词高亮；动态模式下会自动订阅更新。
- 静态导出模式下，搜索仍可用（前端 worker 索引）。

#### 4) OpenSpec CLI 执行路径（execute-path）

- 当 OpenSpec CLI 不可用或版本不兼容时，会弹出 `OpenSpec CLI Required`，可直接输入 `Execute Path` 并立即重检。
- 你也可以在 `Settings` 中查看和修改 execute-path。
- 适用于带空格路径、命令 + 参数等复杂执行入口。

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
- 无 PTY 终端运行能力
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

查看底部状态栏中的静态快照提示（已与底部状态栏融合）以确认静态模式已激活。

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

基于 Nix 的 CI 导出示例：

```yaml
- uses: DeterminateSystems/nix-installer-action@v21
- uses: DeterminateSystems/magic-nix-cache-action@v13
- run: nix run github:jixoai/openspecui -- export -o ./dist --base-path /my-repo/
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

# 启动 Bun + OpenTUI 开发面板
pnpm dev

# 旧版多进程开发脚本
pnpm dev:legacy

# 可选：使用 Nix 开发环境
nix develop
```

### 包说明

| 包名                      | 描述                               |
| ------------------------- | ---------------------------------- |
| `openspecui`              | CLI 工具和打包的 Web UI            |
| `@openspecui/core`        | 文件适配器、解析器、验证器和监视器 |
| `@openspecui/search`      | 搜索 Provider 与索引能力           |
| `@openspecui/server`      | tRPC HTTP/WebSocket 服务器         |
| `@openspecui/ai-provider` | AI 提供者抽象层（API 和 ACP）      |
| `@openspecui/web`         | React Web 应用                     |
| `xterm-input-panel`       | 终端输入面板插件（移动/桌面）      |

### 技术栈

- **前端**: React 19, TanStack Router, TanStack Query, Tailwind CSS v4
- **后端**: Hono, tRPC v11, WebSocket
- **构建**: pnpm workspaces, Vite, tsdown
- **类型安全**: TypeScript, Zod

### 社区与贡献

- [贡献指南](./CONTRIBUTING.md)
- [行为准则](./CODE_OF_CONDUCT.md)
- [安全策略](./SECURITY.md)
- [支持与反馈](./SUPPORT.md)

### 许可证

[MIT](./LICENSE)
