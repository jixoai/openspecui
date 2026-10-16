# P0/P2 — 检测分级与证据报告

## 检测命令序列

```bash
# 1. 上游有没有新版本（在 pinned submodule 里）
git -C references/openspec fetch --tags
git -C references/openspec describe --tags HEAD        # 当前 pin
git -C references/openspec tag --sort=-v:refname | head -6

# 2. 本仓库是否已被别的会话跟进过（本地 main 可能是旧的）
git fetch origin main --tags
git log --oneline origin/main -8                       # 看近期 release/archive merge
ls openspec/changes/archive/ | tail -3                 # 最新归档的 change
npm view openspecui version                                  # 已发布的版本

# 3. 增量统计（数字进报告必须实算）
git -C references/openspec rev-list --count <old>..<new>
git -C references/openspec diff --stat <old>..<new> -- src/
git -C references/openspec log --format="%h %s" <old>..<new>
```

## 分级判定的关键 diff 面

```bash
# 命令面与契约面零变化 → 窗口内补丁轮换（小）
git -C references/openspec diff <old>..<new> -- src/index.ts docs/agent-contract.md
```

有变化 → 新 major 线：不要套本 skill 的小流程，先读仓库既有 major 线先例
（`openspec/changes/archive/` 里 `target-openspec-cli-*-line` 类 change），规划完整规格调查。

## 本地镜像面影响初判（openspecui 实例）

逐项对照"上游变了什么 vs 我们镜像/投影什么"：

| 上游表面 | 我们的镜像 | 检查点 |
|---|---|---|
| `src/core/artifact-graph/outputs.ts` 识别函数 | `packages/core/src/opsx-types.ts` 的 `isGlobPattern` + web viewer 本地副本 | 函数体是否逐字节未变（提取双版本 diff）；上游新增的守卫在哪一层（展开侧 vs 识别侧） |
| `instructions apply --json` / `status --json` 成员 | `packages/core/src/cli-contracts/workflow.ts` 各 schema | 新成员 optional/absent-when-empty 语义；窗口内旧版本是否还发射 |
| `list --json` 成员 | 同上 + change-list 投影链 | 同上 |
| 消息文本变化 | verbatim 字符串投影的 decode/render | 我们是否消息无关（通常是）；fixture 断言是否硬编码旧文本 |
| Agent 交付矩阵 | `packages/core/src/agent-delivery-registry.ts` | 路径/skillsDir/cleanup 变化；`legacyPathTemplates` 机制 |
| 验证/归档行为 | 我们不镜像（CLI-delegated） | fixture 证据层面 |

**初判结论必须写成可证伪的话**："零生产改动"这类 triage 要标注"待 fixture 矩阵实证"——
1.14.2 轮的 triage 是被 55 个 fixture 测试零断言变化证实的，不是被推定的。

## 证据报告格式（references/<upstream>-<version>-report.md）

照抄仓库最新一份报告的结构（用 **mtime** 找样板：`ls -t references/*.md | head -1`——字典序
`tail -1` 会返回 `openspec-1.9.0-report.md`，"1.14" 逐字符排在 "1.7"/"1.9" 之前，静默指向旧模板）：

1. 头部：orthogonal intents 注释 + 原始需求原文（含日期）
2. `## Decision`：窗口声明代码块 + "是否移动窗口/能力/注册表 series"的一句话结论
3. `## Evidence baseline`：Observed/Package/Pinned tag/Pinned commit/Previous pin/Upstream delta（实算）
4. `## Patch delta by contract relevance`：P1-P6 分级，每条含 upstream commit 短哈希、
   verbatim 契约文本（JSON 形状直接贴）、"OpenSpecUI red today" 段（我们当前为什么缺/错）
5. `## Current owner map`：表格 Surface → Primary production owner → obligation
6. `## Release gate`

报告写作纪律：每个论断给 `文件:行` 或 commit 出处；不确定的写"待实证"；数字全部命令实算
（曾把 21 写成 24 被双通道复核当场抓出）。
