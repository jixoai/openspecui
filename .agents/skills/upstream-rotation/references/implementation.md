# P4 — 切片实现与 vision 走查

## 切片拓扑

```text
Slice 1 pin 轮换（串行先行——install 屏障，独占 pnpm install）
   └─▶ Slice 2..N 功能切片（文件集互斥，可并行子代理）
          └─▶ Slice N+1 fixture 矩阵 + docs + changeset（串行收尾，依赖前面全部绿）
```

切片划分原则：一个切片 = 一个可独立验收的义务 = 一份互斥文件集。两个切片碰同一文件就
合并成一个批次（曾因 Slice 2/4 争抢 `opsx-types.ts` 被复核判 P1）。

## 子代理简报模板（每个切片一份，自包含）

```
角色 + 工作目录 + 基线（HEAD 哈希 + 工作树干净，不符立即停止）
规划文档指针（research-plan 对应切片 + specs delta）
任务步骤（严格按序；含"先红后绿"固定点）
红例纪律：改生产代码前先写新测试跑红，记录失败输出关键行
绿门命令（见下）
纪律：不 commit 不 git add；变更留工作树；prettier 只对显式文件；
     每个被改的 TS/TSX 文件（含测试）保留/更新顶部时间戳意图头（仓库 Delivery Workflow 法则）；
     聚焦测试 exec 直通；常驻进程列 pid+回收证据
报告格式：基线验证/红例/变更清单/绿门结果/差异说明/摩擦点反馈/进程回收
```

子代理一律 `run_in_background: true`。报告回来后编排者**交叉核验 diff**（`git status
--porcelain` 对照报告清单、抽查关键改动），不全信自评——再逐切片提交（显式路径 add，不 -A）。

## 绿门命令（vitest v4 陷阱）

```bash
# 正确：exec 直通 + 子串 filter（引号 glob 会被 vitest 静默丢弃成 0 文件假绿！）
pnpm --filter @openspecui/core exec vitest run official-cli-v14-validation-findings
# 错误：pnpm --filter <pkg> test -- <file>   （-- 后参数被吞，跑全量）
# 错误：vitest run 'src/official-cli-v1*.test.ts'（引号 glob 静默丢文件）

# server 包真实门禁是 typecheck 脚本（裸 tsc --noEmit 是既有误用）
pnpm --filter @openspecui/server typecheck
```

先读目标包 package.json 的 scripts 确认跑器（vitest ≠ node:test），基线数字以当日实跑为准。

## pin 轮换切片专项

**全仓机械审计**（不只上一版号）：

```bash
grep -rn "1\.14\.1\|87c3595\|openspec-cli-114" packages scripts CLAUDE.md AGENTS.md \
  --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.md" --include="*.json" \
  | grep -v node_modules | grep -v CHANGELOG | grep -v "\.changeset/" \
  | grep -v "openspec/changes/archive" | grep -v "references/openspec-1"
```

逐命中分类：**活 pin 面**（轮换）/ 文件头 Original request 溯源（保留）/ 行为归因注释
（保留）/ 窗口内样本字面量（保留——测试逻辑数据）/ 无关依赖（保留）。收尾复验：活旧引用归零。

已知的活面清单（每轮逐个核对，并 grep 找新增）：
package.json alias / fixture 常量+bins 键 / **v13-前缀的 boundary fixture（逃逸 v14 glob）** /
**schemas-root 本地 PINNED_BINS（stale key 会 undefined 传参崩溃）** / upstream-contract-regression
commit 断言 / 冷启动常量+version 断言 / w2 脚本 SHA+version 断言 / prepare 脚本 EXPECTED_COMMIT /
CLAUDE.md 指针 / AGENTS.md pin 行 + clean-build 法则内嵌 SHA + 新架构决策段；
**README 对法则**：凡触碰根 README.md 的发布必须同 PR 更新 packages/cli/README.md（轮换时
至少跑 "README audit clean" 并记录结论）。

**红例与 CP1 观测预期（2026-10-24 实证教训）**：alias 先改 → 单次 install → 常量未改时，
CP1 的三个 1.14.2-era fixture 会跑出**仅 identity 守卫红**（expectPinnedVersion 在契约断言之前
拦截，"全绿"预测在顺序上不可能成立）——预期写法应为"仅 identity 守卫红，零契约断言失败"；
轮换常量后重跑同 fixture 为最终裁决。红因分类纪律：identity 红 = 计划自己的待办步骤，不是
上游回归；真正的上游回归红要在轮换完成后仍残留才成立。

fixture 矩阵纪律：只允许对齐新事实，**绝不放松断言强度**；新用例先真实 CLI 取证再写断言
（mkdtemp 临时项目跑一次，把 stdout 记下来；macOS 是 `mktemp -d` 无 mkdtemp 命令）。

## vision 走查（ego-browser）

规模合宜原则：零生产改动 → 冒烟级（服务起 + 关键页 + console 卫生 + 一个相关功能面）；
有生产 UI 改动 → 全场景。

走查配方（每项都踩过坑）：

```bash
# 构建 + 隔离环境 + PATH 前置 pinned bin（否则系统旧版 CLI 弹版本冲突对话框）
pnpm --filter @openspecui/web run build:dist
PATH="$PWD/packages/core/node_modules/.bin:$PATH" \
XDG_DATA_HOME=<scratch>/home/data XDG_CONFIG_HOME=<scratch>/home/config HOME=<scratch>/home \
pnpm --filter openspecui exec tsx --conditions=development src/cli.ts <project> --web --port <P>
# 就绪探测：curl /api/health 返回 JSON 对象（不是裸 ok，别按字面匹配）
```

vision 子代理简报必带：
- 读 ego-browser SKILL.md + 本次 specs delta
- 预检：终端先用 pinned CLI 跑出期望 payload，再开始浏览器验证
- **console 卫生**：CDP `Page.addScriptToEvaluateOnNewDocument` 注入 hook（window error +
  unhandledrejection + console.error 包装），**先注入自测 error 验证 hook 生效**（防假阴性）；
  hook 不跨 `page.goto`，每页入口重注入
- **黑图防线**：每张截图程序化校验（尺寸/唯一色数/非黑像素比）后再判读；几何争议以
  a11y snapshot + computed CSS 优先；选择器优先语义（`role:button[name=...]`），`ref=` 易 stale
- 清理：记录 pid → kill → `lsof -ti <port>` 验证释放；保留 scratch 供复查

## Round-C 之后

折叠发现 → 若有修复 → 聚焦复绿 → 记录进 implementation log → 进 P5。
