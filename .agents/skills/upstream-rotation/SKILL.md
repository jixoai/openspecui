---
name: upstream-rotation
description: >-
  jixoai/openspecui 仓库专属：跟进 OpenSpec CLI 上游升级并完成全链路交付的工作流
  （1.13.2 与 1.14.2 两轮实战沉淀）。当用户说"上游有更新/新版本发布了，跟进一下"、
  "openspec X.Y.Z 释放了，更新本地引用"、"适配新版本"、"继续跟进上游升级"，或发现
  references/openspec submodule / 固定 fixture 落后于上游 tag 时使用。覆盖：调查分级 →
  worktree → 证据报告 → openspec change → 双通道 remix 复核 → 子代理切片实现 →
  vision 走查 → 门禁 → PR → 归档 → 发布验证 → 资源回收。即使用户只说"看看有没有更新"，
  检测到新版本后也走本流程。
---

# Upstream Rotation（上游升级跟进工作流）

把一次上游升级跟进变成可复现的流水线。每个阶段有**门**（gate）：门不过不进下一阶段。
本 skill 是编排层——具体操作细节按阶段读对应的 reference 文件。

```text
P0 检测分级 ──gate: 变更类型判定──▶ P1 环境准备 ──gate: 规划基线提交──▶ P2 证据报告
                                                                    │
P6 交付发布 ◀──gate: 资源回收审计── P5 门禁与PR ◀──gate: 复核批准── P3 change + 双通道复核
                                                                    │
                                                                    ▼
                                                          P4 切片实现 + vision 走查
```

## 开始前必须知道的三件事

1. **每个阶段都有实战教训换来的铁律**（为什么会有这条规则都写在规则旁边）。跳过铁律的
   代价在本仓库历史上真实发生过：版本字面量漏网、CI 抖动误判、PR 假合并、发布证据不足。
2. **子代理一律后台运行**（`run_in_background: true`），编排者保持并行响应能力；等待一律用
   事件回调（task-notification），不轮询。
3. **写报告/文档时基于真实命令输出**，不凭记忆。凡是你声明"已验证"的事实，必须真的跑过命令。

---

## P0 — 检测与分级

触发：用户问"上游有没有更新"或明确给出新版本。

1. 在 pinned submodule 里 `git fetch --tags`，对比当前 pin 与最新 tag。
2. 先回答一个背景问题：**这条线是否已经被别的会话跟进了**（看 `git log origin/main` 近期
   merge、`openspec/changes/archive/` 最新归档、npm latest 版本）。本地 main 可能是旧的，
   先 `git fetch origin main --tags`。
3. 计算增量：`git log --oneline <old>..<new>`、`git diff --stat <old>..<new> -- src/`。
4. **分级判定**（决定后续工作量）：
   - `src/index.ts`（命令面）与 `docs/agent-contract.md`（契约面）**零变化** → 窗口内
     补丁轮换（小，通常 1-2 切片）
   - 有新命令/flag/契约 → 新的大版本适配线（大，走完整规格调查，参考仓库既有 major 线先例）
5. 对照本地镜像面做影响初判（哪些我们镜像/投影的上游表面变了）。

详细清单与命令：读 `references/investigation.md`。

**Gate P0**：能一句话说清"这是什么类型的变更、预计几个切片、哪些本地表面受影响"。

## P1 — 环境准备

1. `git worktree add ../<repo>-worktrees/update-<name> -b target/<name>-patch origin/main`
   （基于远端 main，不是本地 main——本地可能是旧的）。
2. submodule checkout 到新 tag，确认 `git submodule status` 无 `+` 前缀。
3. 后台跑依赖安装（后续切片的串行屏障）。

**Gate P1**：worktree 干净、pin 记录在 gitlink、依赖装完。

## P2 — 证据报告

写 `references/<upstream>-<version>-report.md`（仓库既有格式）：

- Decision（窗口/fixture 轮换声明）+ Evidence baseline（tag/commit/diff 统计——**数字用
  `git rev-list --count` 实算**，不许抄估）
- 按"P1 必须适配 / P2 必须适配 / P3 parity / P4 fixture 证据 / P5 无表面 / P6 非义务"分级，
  每条给 upstream commit 佐证
- **Owner map**：每个变更对应本地生产 owner 文件（这是后续复核的核对表）
- Release gate

**Gate P2**：报告里每个"确认/不受影响"论断都有 diff 或源码出处。

## P3 — openspec change + 双通道复核（remix）

1. 写 change 工件：`openspec/changes/update-<name>/`（`.openspec.yaml` + `loop/{intake,
   research-plan,checkpoints,implementation}.md` + `specs/*/spec.md` deltas（补丁轮换可能
   零 delta，则省略 specs 目录））。提交规划基线。
2. **双通道 Round-A 并行**：
   - **Codex 通道**（herdr + 大地三档模型 + xhigh）：先探测 Codex 执行环境——新 Provider 的
     沙箱可能没有本地文件系统甚至没有 shell（NO-SHELL）。不可用时切换**内联材料复核模式**
     （协议见 `references/review-remix.md`）。
   - **research 子代理通道**：同一复核简报，独立执行。
   - 两路发现**收敛**是最强置信信号；分歧点单独裁决。
3. 折叠全部发现 → Round-B 批准轮（同通道）→ 记录评分。
4. 复核回调一律用后台 `~/.zcode/scripts/codex-callback.sh <agent-name>`（若无执行位先 chmod +x）。

复核提示词模板、内联材料协议、评分要求：读 `references/review-remix.md`。

**Gate P3**：Round-B 明确批准（评分与理由记录进 checkpoints），才允许动生产代码。

## P4 — 切片实现 + vision 走查

1. 按 research-plan 切片分发子代理（简报模板与纪律见 `references/implementation.md`）：
   - **pin 轮换切片串行先行**（install 屏障），其余切片文件集互斥可并行，fixture 收尾串行。
   - 每个切片：先红后绿（红例在命名的固定点）、聚焦绿门命令、报告含摩擦点反馈。
2. 编排者对每个子代理报告**交叉核验 diff**（不全信自评），逐切片提交。
3. **vision 走查**（ego-browser）：冒烟或全量按变更规模定。配方、黑图防线、console 卫生、
   进程回收纪律见 `references/implementation.md` 的走查节。
4. Round-C 实现复核（同 P3 通道）+ 折叠。

**Gate P4**：全部切片绿 + 走查 PASS + Round-C 批准。

## P5 — 门禁与 PR

1. 全量门禁串行：`format:check` → `lint:ci` → `typecheck` → `test:ci` → `test:browser:ci`。
2. PR 描述要点：变更摘要、复核轨迹（评分）、走查结论、**lockfile churn 解释**（若 pin
   触发布局压缩）、时序敏感面处置规则。
3. CI 监视合并，**合并后必须 `gh pr view --json state,mergedAt` 验证**——门禁 pending 时
   `gh pr merge` 会被拒但脚本可能假报成功（实战踩过）。
4. **CI 抖动处置铁律**：先本地复跑定位 → 触发失败作业**零变更重跑** → 通过则定性为时序面
   并记录，**不许直接加 timeout**（资源拓扑优先于膨胀超时是仓库法则）。
5. 归档：rebase main → pinned CLI `archive <change> -y` → 归档 PR → 合并验证。

**Gate P5**：实现 PR + 归档 PR 均 mergedAt 验证通过。

## P6 — 发布与回收

1. **发布需 Owner 明确确认**（"继续跟进"不等于"发布"）。
2. `pnpm changeversion`（在主检出 main 上跑；worktree 不能持有 main）。changeversion 自带
   版本 PR → 检查 → 合并 → release 等待；**它可能误报 workflow failed**（轮询过早），以
   run 实际 conclusion 为准。
3. **四项独立证据逐项验证**（缺一不可，npm 是逐包传播的要轮询到齐）：
   main head（版本 PR merge）/ 远程标签 / GitHub Release / **npm 每个包**。
4. 发布后验证 submodule gitlink 未被版本提交倒退（历史事故，已有根修但仍要验）。
5. 资源回收 + 残留审计：worktree、本地/远程分支、herdr（只关自己建的 workspace；server
   若已被他人附着则**不停**）、/tmp、端口、孤儿进程。最后跑一遍审计命令清单并向 Owner
   交代：残留物、被挡的回写、并行会话的进程归属。

**Gate P6**：四项证据在案 + 审计清单向 Owner 交代完毕。

---

## 铁律速查（每条后面是它的学费）

| 铁律 | 学费 |
|---|---|
| 版本字面量审计用**全仓机械 grep**（旧版号+旧SHA+新版号+新SHA+alias 名+常量名），不只 grep 上一版 | W2 脚本 `1.12.0` 漏网（规划与 Round-A/B 均未抓，Round-C 才捕获） |
| 文件名前缀会逃逸 glob（`v13-*` 不匹配 `v14-*`），聚焦命令用**子串 filter** | vitest 引号 glob 静默丢文件假绿 |
| 聚焦测试一律 `pnpm --filter <pkg> exec vitest run <file>` | `test --` 传参被吞跑全量 876s |
| PR 合并必须验证 `mergedAt` | pending 时 merge 被拒但脚本报成功 |
| CI 时序失败先零变更重跑定性 | 把抖动当代码缺陷排查浪费整轮 |
| npm 完成判据**逐包**解析验证 | workflow success ≠ 全包可解析 |
| 发布后验证 submodule gitlink | changeversion 曾把 pin 倒退一版 |
| 走查配方 PATH 前置 pinned CLI bin | 系统 openspec 1.4.1 弹版本冲突对话框 |
| Codex 新 Provider 先探测执行环境 | 无 FS/shell 的复核只能靠内联材料模式 |
| 声称"已验证"的事必须真跑过命令 | 报告数字抄错（24≠21）被复核当场抓 |

## 何时读哪个 reference

- P0/P2 细节 → `references/investigation.md`
- P3 复核协议与提示词模板 → `references/review-remix.md`
- P4 切片简报模板、绿门、走查配方 → `references/implementation.md`
- P5/P6 PR/发布/回收清单 → `references/delivery.md`
