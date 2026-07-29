<!--
Orthogonal intents (created 2026-07-30 Asia/Shanghai):
1. Give the Owner a command-exact packed-CLI acceptance procedure.
2. Separate daemon, backend, Workspace, native-window, and Browser presentation observations.
3. Define PASS, FAIL, NOT RUN, and restore boundaries without retaining credentials.
4. Keep final Browser/PWA/OpenTray visual judgment Owner-only.

Original request (2026-07-20): "以后任何需要最终端到端的浏览器走查，就交给我来做。"
Original request (2026-07-29): "多次执行 openspecui --app 其实只是在激活同一个 daemon。"
-->

# OpenTray App Mode Owner Acceptance

本流程验收 `integrate-app-mode-with-opentray` 的真实发布边界。Agent 的 Vitest、组件 Playwright、clean build 和 installed-runtime 证据只是准备；下列 Browser/PWA/OpenTray 结论只由 Owner 记录。

结果只写 `PASS`、`FAIL` 或 `NOT RUN`、当前 commit、平台和最短复现。不要记录 credential、Authorization header、URL fragment 或完整 daemon 日志。

## 0. 构建并安装候选包

从仓库根目录执行：

```bash
export ROOT="$PWD"
export HEAD="$(git rev-parse HEAD)"
export LAB="$(mktemp -d /tmp/openspecui-opentray-owner.XXXXXX)"
export OPENSPECUI_HOME="$LAB/home"
export XDG_DATA_HOME="$LAB/xdg"

mkdir -p "$LAB/pack" "$LAB/install" "$OPENSPECUI_HOME" "$XDG_DATA_HOME"
pnpm --filter @openspecui/core build
pnpm --filter @openspecui/server build
pnpm --filter openspecui build
(cd packages/cli && pnpm pack --out "$LAB/pack/openspecui-%v.tgz")
(cd "$LAB/install" && pnpm init && pnpm add "$LAB/pack/openspecui-6.0.0.tgz")

export CLI="$LAB/install/node_modules/.bin/openspecui"
"$CLI" stop
test ! -e "$OPENSPECUI_HOME/run/daemon.sock"
printf 'candidate=%s\nlab=%s\n' "$HEAD" "$LAB"
```

PASS：build、pack、install 均退出 `0`；`$CLI` 指向安装包，不是仓库源码；初始 daemon endpoint 不存在。当前准备基线为 `fc889898b9457122fccf270995152c083eea4a67`，若 HEAD 不同，结果必须记录实际 HEAD。

验收项目：

```text
A = $ROOT
B = $ROOT/references/openspec
```

它们都是真实 OpenSpec root。所有 backend 命令保持前台运行；不要把它们改成后台守护进程。

## AT-01 交互式 App admission

确保 daemon 不存在：

```bash
"$CLI" stop
```

在真实交互式终端执行：

```bash
"$CLI" serve "$ROOT" --port 33101
```

必须出现：

```text
Start OpenSpecUI App? [Y/n]
```

直接按 Enter。

PASS：先启动一个 native App daemon，再启动 A backend；A 只出现在一个 `Workspaces` surface；终端保持前台并显示 backend URL。FAIL：没有询问、出现旧 `Sessions` 文案、启动第二个 App shell，或 daemon 接管了前台 backend。

恢复：在该 backend 终端按一次 `Ctrl+C`，再执行：

```bash
"$CLI" stop
test ! -e "$OPENSPECUI_HOME/run/daemon.sock"
```

重新执行同一 `serve` 命令并输入 `n`。PASS：只打开 Direct Project Web，不启动 daemon。结束后按一次 `Ctrl+C`。

## AT-02 双 Workspace 与 Open in browser

终端 T0：

```bash
"$CLI" start
```

终端 T1：

```bash
"$CLI" serve "$ROOT" --app --port 33101
```

终端 T2：

```bash
"$CLI" serve "$ROOT/references/openspec" --app --port 33102
```

PASS：只存在一个 OpenTray App window；`Workspaces` 同时显示 A/B；切换 tab 时两个 Project Web 各自保持内容和 iframe 状态，不出现第二个 App window。

分别点击 A/B tab 的 `Open in browser` icon button。

PASS：系统浏览器分别打开 `33101` 和 `33102` 的 Direct Project Web；按钮有可访问 tooltip/label；App tab 不被移除或重建。FAIL：页面可提交任意 URL、打开错误 backend、按钮永久 pending，或动作泄漏 private fragment。

恢复：保持 T1/T2 继续运行，供后续用例使用。

## AT-03 重复激活与 retained native window

保持 T1/T2 和 native App window：

```bash
"$CLI" start
"$CLI" start
```

PASS：两次命令都只聚焦同一个 native window；A/B tabs 和当前选择保持；没有新的 daemon、window 或 App Document。

点击 native close control 隐藏窗口，然后执行：

```bash
"$CLI" start
```

PASS：原窗口重新可见并获得焦点，A/B 状态仍在；没有重新播放首次尺寸/位置 bootstrap，也没有空白闪现后重建 Workspace。

恢复：保持当前状态。

## AT-04 daemon restart 不接管 backend

先确认两个 backend 健康：

```bash
curl --noproxy '*' -fsS http://127.0.0.1:33101/api/health >/dev/null
curl --noproxy '*' -fsS http://127.0.0.1:33102/api/health >/dev/null
```

执行：

```bash
"$CLI" stop
curl --noproxy '*' -fsS http://127.0.0.1:33101/api/health >/dev/null
curl --noproxy '*' -fsS http://127.0.0.1:33102/api/health >/dev/null
"$CLI" start
```

PASS：daemon 停止期间 A/B backend 始终健康；新 App window ready 后，两个 live lease 自动恢复 A/B Workspaces，不需要重启 T1/T2。FAIL：任一 backend 被 daemon stop 杀死、Workspace 永久丢失，或需要刷新/重新 serve 才恢复。

恢复：保持 T1/T2 与新 native App window。

## AT-05 host mode 不可变

native daemon 运行时执行：

```bash
"$CLI" start --web
```

PASS：命令退出非 `0`，且精确提示：

```text
OpenSpecUI App daemon is running in native mode. Run openspecui restart --web to change startup mode.
```

然后执行：

```bash
"$CLI" restart --web
```

PASS：native window 被有序销毁，Browser-hosted bundled App 打开；T1/T2 backend 不中断并重新出现为两个 Workspaces。FAIL：运行态偷偷变更 host、残留 native window，或 restart 杀死 backend。

恢复：暂时保持 Web daemon，供 AT-06 使用。

## AT-06 Web host 与 Browser/PWA 状态

在 Web daemon 运行时执行两次：

```bash
"$CLI" start --web
"$CLI" start --web
```

PASS：每次都激活当前 daemon 的同版本 bundled App；Workspaces 保持 A/B；页面没有 native bridge，标题栏使用普通 Browser 状态且 inset 为 0；Console 不出现 `@opentray/ext-webview` 初始化错误。

若当前浏览器允许把该 loopback App 安装为 PWA，在同一 daemon 生命周期内安装后再执行一次 `"$CLI" start --web`：PASS 为已安装 surface 能处理当前 App URL，且 PWA overlay 只有一个 inset owner。浏览器/平台不提供该能力则记 `NOT RUN`，不得用组件测试代替。

普通浏览器是否复用现有 tab 受系统 Browser opener 策略影响；本用例要求 daemon/App 状态正确，不把浏览器拒绝脚本聚焦误报成 Workspace 丢失。

恢复：

```bash
"$CLI" restart
```

等待 native App 与 A/B Workspaces 恢复。

## AT-07 macOS OpenTray overlay 与 hit region

仅在 macOS native App 执行；其他平台记 `NOT RUN`。

1. 将窗口缩窄到约 700px，再放大到桌面宽度。
2. 检查 traffic-light controls 与 AppHeader/Workspace tabs 不重叠。
3. 在标题栏无交互空白处拖动窗口。
4. 分别从 Workspace tab、Open in browser、Close、导航按钮、输入框上按下并拖动。

PASS：空白标题栏可拖动；所有交互控件正常点击/选择且不会拖动窗口；resize 过程没有双 inset、横向页面滚动或按钮遮挡；overlay geometry 变化平滑收敛。FAIL：PWA/OpenTray inset 叠加、控件成为 caption drag region，或 late geometry 在 source 退休后仍改变布局。

## AT-08 Windows native-frame baseline

仅在可用的 Windows OpenTray 环境执行；当前 macOS 验收不能替代，缺少环境时记 `NOT RUN`。

```powershell
openspecui start
```

PASS：使用系统 native frame，不伪造 overlay；窗口可 resize；重复 start 聚焦 retained window；App controls 不进入系统 caption region。FAIL：声称 macOS overlay 行为、出现双标题栏/无 frame，或加载不支持的 overlay capability。

## AT-09 Direct Web 与 serve owner 退出

先停止 daemon，但保持 T1/T2：

```bash
"$CLI" stop
curl --noproxy '*' -fsS http://127.0.0.1:33101/api/health >/dev/null
curl --noproxy '*' -fsS http://127.0.0.1:33102/api/health >/dev/null
```

终端 T3：

```bash
"$CLI" serve "$ROOT" --web --port 33103
```

PASS：直接打开 Project Web，不启动 App daemon。打开后在 T3 按一次 `Ctrl+C`。

PASS：T3 一次信号即退出，`33103` 不再监听；T1/T2 仍健康。FAIL：需要第二次信号、daemon 被隐式启动、或退出一个 serve 影响另一个 backend。

## 1. 收尾与结果

在 T1/T2 各按一次 `Ctrl+C`，然后执行：

```bash
"$CLI" stop
test ! -e "$OPENSPECUI_HOME/run/daemon.sock"
! curl --noproxy '*' -fsS http://127.0.0.1:33101/api/health >/dev/null
! curl --noproxy '*' -fsS http://127.0.0.1:33102/api/health >/dev/null
git status --short
```

判定：

- AT-01 至 AT-07、AT-09 任一 `FAIL`，checkpoint 10 Owner acceptance 不成立。
- AT-08 在没有 Windows 环境时允许 `NOT RUN`，但不得记为 PASS；后续 Windows release confidence 仍保留该平台风险。
- 只回报失败 ID、实际 HEAD、平台、最短复现和去敏截图/Console；不要粘贴 credential 或 private fragment。
- 全部可执行项通过后，由 Owner 明确回复验收结论；Agent 才能关闭 10.2-10.4 并继续 PR/CI，不在本流程中 merge、archive 或 release。

临时目录保留到结果记录完成。确认无需复查后再由 Owner删除 `$LAB`。
