<!--
正交意图（创建于 2026-07-31 Asia/Shanghai）：
1. 为 Owner 提供一套可重复执行的 Workspaces / Stores 全界面视觉走查矩阵。
2. 区分客观布局缺陷、主观打磨意见和功能验收结果。
3. 将截图与观察结果绑定到精确的产品提交、视口、主题和界面状态。

用户原始需求（2026-07-31）："你列一份详细的视觉走查测试的清单，如果有必要也顺便准备一些必要的脚本方便我完成走查工作"
-->

# Owner 视觉走查：Workspaces 与 Stores

待走查的产品实现：`cce6c4c6eade1172964a5975a829d0b86ff75a9b`。

本文是 `owner-walkthrough.md` 的视觉验收补充，重点检查信息层级、响应式拓扑、滚动归属、状态连续性和动效。它不能替代功能 PASS/FAIL 用例，也不代表可以进行 archive 或 merge。

## 1. 准备工作

在仓库根目录执行：

```bash
bun scripts/owner-workspaces-stores-visual.sh.ts doctor
bun scripts/owner-workspaces-stores-visual.sh.ts setup
bun scripts/owner-workspaces-stores-visual.sh.ts build
bun scripts/owner-workspaces-stores-visual.sh.ts start-app
```

打开 DevTools 并按以下方式配置：

- Rendering：仅在 M3 用例中模拟 `prefers-reduced-motion`。
- Network：仅在指定的加载态用例中使用 `Fast 3G`，完成后恢复 `No throttling`。
- Console：启用日志保留。出现渲染死循环、未捕获 Promise rejection、hydration error 或请求风暴，一律判定为失败。
- Screenshots：只截取应用视口，不包含完整浏览器外壳。

必须使用下面的固定矩阵。视口边界本身就是验收内容，不要用相近尺寸替代。

| 编号 |       视口 | 目的                           |
| ---- | ---------: | ------------------------------ |
| D1   | 1440 x 900 | 宽裕桌面：侧栏与内容密度       |
| D2   | 1024 x 768 | 受限桌面：保留侧栏时的内容布局 |
| T1   |  768 x 900 | 导航断点与窄内容区域           |
| M1   |  390 x 844 | 主要移动端走查尺寸             |
| M2   |  320 x 720 | 最拥挤的最小宽度压力测试       |

D1 和 M1 必须分别在浅色、深色主题下执行。其它用例可选择更容易暴露问题的主题。

## 2. 全局视觉法则

每张截图都必须满足：

- [ ] D1、D2、T1、M1、M2 均无页面级横向滚动条。
- [ ] 文本、图标、Tooltip、Dialog、标题栏控件和焦点环互不遮挡。
- [ ] 当前页面只有一个明确的纵向滚动 owner。
- [ ] 长路径只能在所属区域内截断或换行，不能撑宽页面。
- [ ] 图标按钮保持稳定的正方形点击区域，并具备可访问名称或 Tooltip。
- [ ] Loading 指示器不得改变按钮、行、Tab、Dialog 或页面标题的尺寸。
- [ ] 错误和 authority 丢失必须出现在直接视觉平面，不能只藏在 Tooltip 或折叠区。
- [ ] 次要诊断信息在视觉上弱于当前任务与下一步操作。
- [ ] 浅色和深色表面上的焦点环都清晰可见。
- [ ] 浏览器缩放至 200% 时，所有命令仍可触达，内容不重叠。

出现以下任意情况，立即判定为失败：

```text
双滚动条 | 命令被裁切 | 焦点不可见 | 端口成为主身份
Pending 导致布局跳动 | 嵌套卡片造成视觉噪音 | 错误只存在于 Tooltip
移动端残留桌面侧栏 | iframe 重挂载闪烁 | 重复渲染或请求死循环
```

## 3. App 外壳与导航

### C1. 桌面外壳：D1、D2

- [ ] 自绘标题栏与页面内容有明确边界，且不遮挡第一行内容。
- [ ] Workspaces 和 Stores 是仅有的两个一级业务入口。
- [ ] Settings 明显处于次要位置，不与两个业务入口竞争。
- [ ] Workspaces 展开后呈现为子列表，而非新的第三级导航。
- [ ] 选中、Hover 和键盘焦点三种状态不只依赖颜色区分。
- [ ] 侧栏与运行中 Workspace 均不使用端口作为标题。

截图：`C1-D1-light`、`C1-D1-dark`、`C1-D2`。

### C2. 移动端外壳：T1、M1、M2

- [ ] 桌面侧栏完全消失；移动端 Header 能容纳 Workspaces 和 Stores，且不拥挤。
- [ ] 进入 Workspaces 后，Header 下方显示运行中 backend 的二级导航。
- [ ] 二级区域高度有上限；仅在内容超出时拥有自己的滚动条。
- [ ] 展开运行列表不会把主要操作推出视口，也不会制造两个纵向滚动 owner。
- [ ] M2 下所有图标和标签仍可完整点击，尾部操作不被裁切。

截图：`C2-T1`、`C2-M1-light`、`C2-M1-dark`、`C2-M2`。

## 4. Workspace Home

### H1. 空 Home：D1、M1、M2

- [ ] Home 在视觉上固定为第一个 Tab，不会被误认为项目 Tab。
- [ ] Favorites 和 Recent 为空时，不留下夸张空白或空卡片。
- [ ] `Start from path` 是最主要的动作；Task Manager 可发现但保持次要。
- [ ] Path Input 与提交操作在所有宽度下都是一个连贯的控件组。
- [ ] 完整本地路径可读、可获取，但不支配页面视觉。

### H2. 有数据的 Home：D1、M1

完成标准功能走查的用例 1-2 后检查：

- [ ] Favorites 位于 Path Form 上方，Recent 位于其下方。
- [ ] 收藏行与相同的最近目录不会看起来像两个运行时身份。
- [ ] 有客观 Git 数据时优先显示 GitHub `org/repo`，否则回退到文件夹名。
- [ ] Git 分支作为副标题；完整路径使用更低的视觉权重。
- [ ] 收藏状态能被立即识别，切换时不改变行几何尺寸。
- [ ] 极长仓库名或文件夹名使用一致的截断规则，完整值仍可获取。

### H3. 启动生命周期：D1、M1

分别使用有效路径、无效路径和符号链接别名：

- [ ] 提交后立即锁定，并显示稳定、弱文字化的活动反馈。
- [ ] 重复点击或按 Enter 不会产生重复活动或几何变化。
- [ ] 失败信息紧邻 Form，且不会清空 Favorites / Recent。
- [ ] 成功后聚焦唯一 Workspace，不闪现中间空 Home。
- [ ] 使用别名启动时聚焦已有行，不产生重复动效或 Tab。

截图：`H1-empty-M1`、`H2-populated-D1`、`H2-populated-M1`、`H3-pending-M1`、`H3-error-M1`。

## 5. Workspace Tabs、Favorites 与 Backend 观测

### W1. Tab Strip：D1、D2、M1

- [ ] Home 始终位于第一位；项目 Tabs 可以滚动，但不会带动 Home。
- [ ] 每个 Tab 使用仓库名或文件夹名作为标题，可选分支作为副标题；直接标签中没有端口。
- [ ] Close、Active、Hover、Loading、Offline、Frame Error 状态均可明确区分。
- [ ] 长标签不会改变 Tab Strip 尺寸，也不会遮挡 Close / Open in browser。
- [ ] 切换 Tab 时保留 iframe 内容，不出现白屏、骨架重启或 Tab 宽度跳动。

### W2. Favorites 二级导航：D1、M1

准备两个收藏目录，并启动两个 managed backend 和一个 external backend：

- [ ] Workspaces 下直接罗列收藏目录；不存在 `Running(n)`、`Favorites` 标题或折叠按钮。
- [ ] 点击未运行的收藏目录可启动，点击已运行的收藏目录可聚焦；Pending 尺寸稳定。
- [ ] 侧栏不使用 backend URL、端口或 external owner 作为目录身份。
- [ ] 选择一行后，导航和 Tab Strip 都能明确显示 Active 状态。
- [ ] 增删和排序使用物理连续的列表动效；未受影响的行平滑位移而非瞬移。

### W3. Task Manager：D1、M1、M2

- [ ] 所有行构成一个连续的操作列表，而非一组独立浮动卡片。
- [ ] 标题、分支、路径、Owner、健康状态和操作具有清晰的递减层级。
- [ ] M2 下 Favorite、managed Stop 和确认操作仍全部可触达。
- [ ] 只有 Health API 成功且 WebSocket 已建立的精确 registration 显示 Running。
- [ ] HTTP 成功但 WebSocket 未建立时保持 Checking；WebSocket 断开后显示 Realtime unavailable。
- [ ] Stop 确认态不改变行尺寸，也不突然推动相邻行。
- [ ] Pending Stop 只锁定目标行，其余列表保持可用。
- [ ] backend 被移除后，相邻行平滑归位，不发生 DOM 闪烁。
- [ ] External owner 没有可调用 shutdown 时，不显示 Close、Remove、Delete 或 Stop。

截图：`W1-tabs-D1`、`W1-tabs-M1`、`W2-favorites-M1`、`W3-task-D1`、`W3-task-M2`、`W3-stop-pending`。

## 6. Workspace Launcher

在另一个终端启动手动 backend：

```bash
bun scripts/owner-workspaces-stores-visual.sh.ts serve-manual
```

### L1. Candidate 列表：D1、M1、M2

- [ ] Candidate 列表位于直接视觉平面；选择次要命令前不显示 URL Input。
- [ ] Search、行身份、Reachability、主命令和 Overflow Menu 对齐一致。
- [ ] Dialog 在 M2 下完整容纳于页面；只有 Candidate 区域在必要时滚动。
- [ ] Focus / Open 按钮在 Idle 与 Pending 状态下保持相同宽度。
- [ ] 行 Overflow Menu 保持在视口内，并显示在相邻内容上方。

### L2. 手动连接与失败：D1、M1

- [ ] Back 操作保留 Candidate 列表，不会在视觉上重建 Dialog。
- [ ] 探测期间 Input、Back、Cancel、Connect 的几何位置保持稳定。
- [ ] Connect 在完整探测周期内锁定，并使用原位 Spinner。
- [ ] Offline、Authentication Required、Incompatible 显示不同的直接错误信息。
- [ ] 探测失败既不添加行，也不会短暂打开 iframe 或 Tab。
- [ ] 连接成功后 Dialog 只关闭一次，并聚焦唯一 Tab，不产生重复动效。

截图：`L1-list-D1`、`L1-list-M2`、`L2-form-M1`、`L2-pending-M1`、`L2-offline-M1`。

## 7. Stores Index

准备 Store fixtures，并在不同终端运行两个 Environment backends：

```bash
bun scripts/owner-workspaces-stores-visual.sh.ts setup-stores
bun scripts/owner-workspaces-stores-visual.sh.ts serve-env-a
bun scripts/owner-workspaces-stores-visual.sh.ts serve-env-b
```

### S1. Environment 选择与列表：D1、D2、M1、M2

- [ ] Environment 选择器足以解释当前作用域，但不能看起来像 backend URL 选择器。
- [ ] Search、健康过滤、Refresh、Environment Evidence 和 New Store 组成可预测的工具栏。
- [ ] 不同 Environment 中同 id 的 Stores 不会合并成含义不明的一行。
- [ ] Store 行是带分隔线的列表项，而非压缩到移动端的桌面表格。
- [ ] Health、Usage 和 Mutation 信息在移动端重排为可读拓扑。
- [ ] 极长 Store id 或 Root 不会制造横向溢出。
- [ ] 插入、删除和过滤操作保持行的物理连续性。

### S2. Projection 生命周期：D1、M1

启用 Network throttling 后触发 Refresh：

- [ ] 初始 Skeleton 行之间有明确间距，并近似最终行几何尺寸。
- [ ] Retained Refresh 保留已有行可读性，仅增加克制的 Updating 反馈。
- [ ] Refresh 在完整请求周期内锁定；重复点击不会叠加 Spinner 或请求。
- [ ] Regional Error 保持直接可见，同时保留行明确表现为非当前 authority。
- [ ] 空结果、过滤后为空、缺少 Environment 三种状态有明确差异。
- [ ] Source Conflict 表现为错误，而非空 Stores 或健康页面。

截图：`S1-index-D1`、`S1-index-M1`、`S1-index-M2`、`S2-skeleton`、`S2-retained-update`、`S2-conflict`。

## 8. Store Detail

### DTL1. 直接视觉平面：D1、M1、M2

- [ ] Store id 是主标题；Environment identity 是紧凑的次要上下文。
- [ ] Health / Usability 与 Authority Loss 无需展开即可看到。
- [ ] Source Conflict 保留准确文案与 Error Severity。
- [ ] `Root for` 与 `Referenced by` 明确表示已观察关系，而非全局事实。
- [ ] Specs 与 Active Changes 是只读内容摘要，并各自拥有独立 Loading / Error 状态。
- [ ] 一个区域失败时另一区域保持稳定，整体布局不塌陷、不跳动。

### DTL2. Evidence 与破坏性操作：D1、M1

- [ ] Repository Facts 与健康 CLI Evidence 保持次要，默认折叠。
- [ ] 展开 Evidence 后，长路径或 JSON 不会制造页面级横向滚动。
- [ ] Unregister 与 Remove 明确表达为不同操作。
- [ ] 破坏性 Dialog 明确显示 Store 名称和后果；确认输入在 M1 下完整可用。
- [ ] Pending Mutation 锁定 Dialog 关闭操作，并保持命令尺寸稳定。
- [ ] Mutation Failure 在 Dialog settle 后仍直接显示，不隐藏在历史记录中。

截图：`DTL1-healthy-D1`、`DTL1-conflict-M1`、`DTL1-regional-error-M2`、`DTL2-evidence-M1`、`DTL2-remove-pending`。

## 9. 连续性、动效与压力测试

### M1. 路由与 iframe 连续性

- [ ] Workspaces -> Stores -> Store Detail -> Workspaces 往返后保留同一个 iframe Document。
- [ ] 不出现白屏、Dashboard Reset、Skeleton Restart、Tab Remount 或滚动位置重置。
- [ ] Navigation 与 Tab Surface 中共享的标题和路径身份在空间上保持一致。

### M2. 实时列表动效

启动、停止、收藏、过滤和重连项目，同时观察运行中导航、Task Manager 和 Stores：

- [ ] 新行以克制的动效进入。
- [ ] 行被移除后，相邻行平滑归位而非瞬移。
- [ ] 过滤或排序保留行身份，不对无关 Chrome 施加动画。
- [ ] 高频更新最终收敛到唯一布局，不反复振荡。

### M3. Reduced Motion

启用 `prefers-reduced-motion: reduce`，重复 M2，然后恢复系统默认：

- [ ] 没有动效时，所有状态变化仍然可以理解。
- [ ] 不出现延迟显示的不可见行或依赖动画才能出现的命令。
- [ ] Loading 和 Error 仍可通过非动效线索识别。

### M4. 长内容压力测试

使用可见长度至少 140 个字符的项目路径和 Store Root：

- [ ] Navigation / Tab 标题按信息层级截断，而非缩小字体。
- [ ] Detail / Evidence 值只在明确框定的 Evidence owner 内换行或滚动。
- [ ] Tooltip 可显示完整单值，但不承载多记录错误。
- [ ] M2 且 200% 缩放时，没有任何操作被长值遮挡。

## 10. 结果记录表

每个命名截图记录一行。只有不违反上述客观法则时，`打磨` 才能被视为非阻塞意见。

| 截图        | Head      | 视口     | 主题  | 状态    | 结果               | 观察记录 |
| ----------- | --------- | -------- | ----- | ------- | ------------------ | -------- |
| C1-D1-light | `cce6c4c` | 1440x900 | light | settled | 通过 / 失败 / 打磨 |          |

每个失败都必须包含：

```text
界面 + 精确视口 + 精确触发步骤 + 截图名称
预期拓扑 + 实际拓扑
交互是否仍然可完成
适用时附上 Console / Request 证据
```

截图和记录表中不得包含 Credential、Authorization Header、Private Launch Fragment 或 Daemon Snapshot。

## 11. 清理

先在三个 foreground `serve-*` 终端中按 Ctrl+C，然后执行：

```bash
bun scripts/owner-workspaces-stores-visual.sh.ts cleanup
```

清理结果不属于验收证据。完成后的记录表与截图必须保存在一次性 `/tmp` fixtures 之外。
