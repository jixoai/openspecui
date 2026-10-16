# P3 — 双通道复核（remix）协议

## 通道一：Codex（herdr）

### 启动序列

```bash
# 0. 负载与网关检查
pgrep -fl "codex|cargo" | head -5
sysctl vm.swapusage

# 1. herdr server 不在跑就无头启动（注意：之后若他人附着，结束时不要停 server）
nohup herdr server >/tmp/herdr-server.log 2>&1 &

# 2. workspace + pane（--cwd 指 worktree；命名 zcode-<alias>-<purpose>）
herdr workspace create --label "zcode-<repo>-<name>-review" --cwd <worktree> --no-focus

# 3. 启动 reviewer（模型按三档抽象取"大地三"；注意模型名以用户当前配置为准——
#    曾经历 gpt-5.6-terra → gpt-6-sol → gpt-6.1-sol 的迁移，启动前看 ~/.codex/config.toml）
herdr agent start codex-reviewer-<name> --kind codex --pane <pane> -- \
  -m <当前大地模型> -c 'model_reasoning_effort="xhigh"' --yolo

# 4. 提交复核请求（前台不加 --wait）+ 后台回调
herdr agent prompt codex-reviewer-<name> "$(cat /tmp/round-prompt.txt)"
# 后台任务跑：
~/.zcode/scripts/codex-callback.sh codex-reviewer-<name>   # 无执行位先 chmod +x
```

### 先探测执行环境（新 Provider 必做）

新 Provider 的沙箱可能：命令在远端 Linux 容器执行（`/home/oai`，无本地文件系统）；
甚至完全没有 shell 工具（NO-SHELL，重启不复现）。先发一个探测：

```
探测：运行 whoami && echo SHELL-OK 贴输出；无命令执行工具则回复 NO-SHELL。
```

- 有本地执行 → 传统模式：直接让它读 worktree 复核。
- 远端执行无本地 FS → 让它在沙箱 `git clone --recurse-submodules -b <branch>` 公开仓库复核
  （需先推分支）。
- NO-SHELL → **内联材料模式**（见下）。

### 内联材料复核模式（实测有效，三轮验证）

把复核材料打成 ~250 行的包喂给 Codex，让它基于材料做批判性评审：

```
材料 1：证据报告全文
材料 2：change 工件全文（intake / research-plan / checkpoints）
材料 3：全仓 pin 字面量机械审计表（编排者本地 grep，命中分类：活面/历史注释/mock/无关依赖）
材料 4：上游关键 diff 摘录（编排者本地 git diff 验证）
材料 5：对向通道（research）的结论——供交叉批判/反驳
输出要求：阻塞问题（P0/P1 + 定位 + 可验证修复）/ 非阻塞 / 事实核验逐项 / 评分 0-10 + 依据
```

包首必须声明证据边界：「以下材料由编排者从真实 worktree 逐字提取并本地验证；你未执行任何
命令，标注'已验证'的部分作为可信输入」。Codex 会诚实声明边界——这正是该模式可用信任的原因。

### 复核输出要求（每轮固定）

- 阻塞问题 P0/P1：文件:行号证据 + 可验证修复建议
- 非阻塞 P2/P3
- 事实核验逐项：确认/纠正
- 评分 0-10 + 依据（与上一轮的变化说明）
- Round-C 允许要求破坏性抽查（临时改坏实现看测试红 → 还原 → 复绿）

## 通道二：research 子代理（并行）

同一复核简报，`research` 类型子代理后台跑。它的优势是真实文件系统访问。
两通道发现**收敛**（独立发现同一批问题）= 最强置信；分歧点由编排者实跑命令裁决。

## 轮次协议

- **Round-A**（change 文档复核，实现未开始）：折叠全部发现 → 修订 change 文档提交。
- **Round-B**（批准轮）：给修订材料 + 逐项处置对照表 → 明确批准才解冻实现。
- **Round-C**（实现复核）：实现 diff 摘要 + 测试证据材料包 → 批准进入门禁与 PR。

每轮评分与结论记录进 change 的 checkpoints / implementation log。复核回来必须实际处理：
「复核已运行」不是完成，P1 修复后要有再验证。

## 会话回收

```bash
herdr agent send-keys <agent> ctrl+c   # codex TUI 退出（agent_not_found 即释放）
herdr workspace close <ws>             # 只关自己建的
# server：若还有别人的 workspace（herdr workspace list 看 label），留着不停
```
