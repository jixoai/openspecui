# P5/P6 — 门禁、PR、发布与回收

## 全量门禁（串行）

```bash
pnpm format:check   # 只查变更文件
pnpm lint:ci        # 0 errors 才算过（warnings 是基线）
pnpm typecheck      # 全部 lane（core 的测试 lane 会抓 vitest 转译层放过的类型问题——类型测试证据法则）
pnpm test:ci        # 全量单测
pnpm test:browser:ci  # 需要 playwright chromium（缺二进制时 pnpm exec playwright install chromium）
```

门禁期抓到的既有环境敏感 flake：`reactive-fs/path-realpath.test.ts` 在 TMPDIR 未 realpath
归一的 macOS 主机上红（main 也红）——期望锚定 `realpath(targetRoot)` 修复，属合法修。

## PR

描述必备段落：Summary（窗口/pin/分级）、What changed、Review trail（各轮评分）、走查结论、
Notes（**lockfile churn 解释**——pin 触发的 pnpm 布局压缩，键集合一致仅 alias 变；
时序敏感面处置规则——若 CI 该测试抖动先零变更重跑定性）。

## CI 监视合并（防假合并）

```bash
gh pr checks <n> --watch
gh pr merge <n> --merge
gh pr view <n> --json state,mergedAt   # 必须！mergedAt 非空才算合并成功
```

门禁 pending 时 `gh pr merge` 被拒但脚本可能假报成功；新推送触发新 CI 轮时尤其注意。

## CI 抖动处置（铁律）

1. 定位失败测试与失败点（`gh run view <id> --log`，注意日志里 run: 块的源码回显会被误读成执行输出）
2. 本地复跑同文件 → 绿则高度怀疑时序
3. `gh run rerun <id> --failed` **零变更重跑** → 通过 = 定性时序面，记录进 change log，不加 timeout
4. 复现才深入排查（对照上游 perf/lazy-load 类提交）

## 归档（第二个 PR）

```bash
git fetch origin main && git checkout -b docs/archive-<name> origin/main
# 前置：P1 的 install 已在当前检出完成；否则用 submodule 源 bin（W2 脚本同款）
#   node references/openspec/bin/openspec.js archive <change> -y
node packages/core/node_modules/openspec-cli-114/bin/openspec.js archive <change> -y
git add openspec/changes openspec/specs && git commit && git push && gh pr create ...
# 归档时 "N incomplete tasks" 警告是预期（描述交付动作本身的条目在归档时才完成）
```

## 发布（P6）

1. **Owner 明确确认后才发布**（"继续跟进"≠"可以发布"）。
2. 主检出 main 上 `git pull --ff-only` → `pnpm changeversion`（worktree 不能持有 main）。
   脚本端到端：版本 PR → 检查 → 合并 → release 等待；**它可能误报 "Release workflow
   failed"**（轮询过早）——以 `gh run view <id> --json conclusion` 实际状态为准。
3. **四项独立证据逐项验证**：

```bash
git log --oneline origin/main -2                          # 1. 版本 PR merge head
git fetch --tags origin && git tag --sort=-v:refname | head  # 2. 远程标签
gh release list --limit 2                                  # 3. GitHub Release (Latest)
for p in <主包> <子包们>; do npm view $p version; done      # 4. npm 逐包轮询到齐
git ls-tree origin/main references/openspec               # 5. gitlink 未被版本提交倒退
```

npm 是**逐包传播**的（先 server 后 core/web，分钟级），轮询直到全部到齐；发布日志里的
`+ <pkg>@<ver>` 与 provenance 签名是"已接受"的证据，registry 可解析是"已可用"的证据。

## 资源回收 + 残留审计

```bash
git worktree remove <path> --force && git worktree list
git branch -D <本地功能分支>...
git push origin --delete <远程功能分支>...   # changeversion 自动分支按仓库惯例保留
rm -rf /tmp/<scratch> /tmp/*-prompt.txt /tmp/pr*-checks.log /tmp/gate-*.log
for port in <用过端口>; do lsof -ti $port | wc -l; done     # 全 0
pgrep -fl "<关键进程>" | grep -v grep                      # 区分自己起的 vs 并行会话的
herdr agent send-keys <agent> ctrl+c && herdr workspace close <ws>
herdr workspace list   # 只剩别人的 → server 留着不停
```

向 Owner 交代的残留清单：不可停的共享资源（herdr server 及附着者）、被沙箱挡住的回写
（skill 摩擦点记录在哪个归档 change 里）、并行会话进程归属、按惯例保留的 changeversion
分支、自己改过的工具文件（如 chmod）。

## 发布期事故记录义务

发布期的三类事故（PR 假合并、npm 逐包传播迟滞、changeversion 误报 workflow failed）目前
只在会话记忆里——**下次轮换发生任何发布期事故时，把它记入归档 change 的 implementation
log**，让铁律速查表逐步做到 10/10 可溯源。

## 视觉验收豁免判据

零生产代码改动的轮换可豁免 Owner 视觉验收——依据：diff 仅 pin 常量/测试/文档/changeset
（`git diff <base>..<head> --stat` 可证）+ vision 走查已程序化验证 UI 原样投影 + 回归烟测
PASS。有生产 UI 改动则必须留 Owner 走查（2026-07-20 边界法则）。
