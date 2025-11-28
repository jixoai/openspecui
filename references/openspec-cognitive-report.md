# OpenSpec 认知报告

> 本报告基于 `references/openspec` 源码和 `/Users/kzf/Dev/GitHub/chain-services/openspec` 真实项目分析生成。

## 1. OpenSpec 核心概念

### 1.1 什么是 OpenSpec

OpenSpec 是一个**规格驱动开发 (Spec-Driven Development)** 工具，用于在 AI 编码助手和人类开发者之间建立共识。核心理念是：**在写代码之前，先就"要构建什么"达成一致**。

### 1.2 核心价值

- **确定性输出**：将需求锁定在规格文件中，而非聊天历史
- **可审查性**：所有变更都有结构化的提案、任务和规格更新
- **共享可见性**：清晰展示什么是提议中的、活跃的、已归档的

## 2. 目录结构

```
openspec/
├── project.md              # 项目约定和上下文
├── AGENTS.md               # AI 助手指令
├── specs/                  # 当前真相 - 已构建的内容
│   └── [capability]/       # 单一聚焦的能力
│       ├── spec.md         # 需求和场景
│       └── design.md       # 技术模式（可选）
└── changes/                # 提案 - 应该改变什么
    ├── [change-name]/
    │   ├── proposal.md     # 为什么、改什么、影响
    │   ├── tasks.md        # 实现清单
    │   ├── design.md       # 技术决策（可选）
    │   └── specs/          # Delta 变更
    │       └── [capability]/
    │           └── spec.md # ADDED/MODIFIED/REMOVED
    └── archive/            # 已完成的变更
```

## 3. 数据模型

### 3.1 Spec (规格)

```typescript
interface Spec {
  name: string           // 从 # 标题解析
  overview: string       // Purpose 部分内容
  requirements: Requirement[]
  metadata?: {
    version: string      // 默认 '1.0.0'
    format: 'openspec'
    sourcePath?: string
  }
}
```

### 3.2 Requirement (需求)

```typescript
interface Requirement {
  text: string           // 需求文本，必须包含 SHALL 或 MUST
  scenarios: Scenario[]  // 至少一个场景
}

interface Scenario {
  rawText: string        // 场景的原始文本内容
}
```

### 3.3 Change (变更提案)

```typescript
interface Change {
  name: string           // 从 # 标题解析
  why: string            // Why 部分内容
  whatChanges: string    // What Changes 部分内容
  deltas: Delta[]        // 至少一个 delta
  metadata?: {
    version: string
    format: 'openspec-change'
  }
}
```

### 3.4 Delta (变更增量)

```typescript
type DeltaOperation = 'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED'

interface Delta {
  spec: string           // 目标 spec ID
  operation: DeltaOperation
  description: string
  requirement?: Requirement
  requirements?: Requirement[]
  rename?: { from: string; to: string }
}
```

## 4. 文件格式规范

### 4.1 Spec 文件格式 (`spec.md`)

```markdown
# [Capability Name] Specification

## Purpose
[描述这个能力的目的]

## Requirements

### Requirement: [需求名称]
The system SHALL/MUST [需求描述]

#### Scenario: [场景名称]
- **WHEN** [条件]
- **THEN** [预期结果]

#### Scenario: [另一个场景]
- **WHEN** [条件]
- **THEN** [预期结果]
```

**关键规则：**
- 必须有 `## Purpose` 部分
- 必须有 `## Requirements` 部分
- 每个需求必须包含 `SHALL` 或 `MUST`
- 每个需求必须至少有一个 `#### Scenario:`
- 场景标题必须使用 `####`（4个井号）

### 4.2 Proposal 文件格式 (`proposal.md`)

```markdown
# Change: [变更简述]

## Why
[1-2 句话说明问题/机会]

## What Changes
- [变更列表]
- [标记破坏性变更为 **BREAKING**]

## Impact
- Affected specs: [受影响的能力列表]
- Affected code: [关键文件/系统]
```

### 4.3 Delta Spec 文件格式 (`changes/[id]/specs/[capability]/spec.md`)

```markdown
# Delta for [Capability]

## ADDED Requirements

### Requirement: [新需求名称]
The system SHALL [需求描述]

#### Scenario: [场景名称]
- **WHEN** [条件]
- **THEN** [预期结果]

## MODIFIED Requirements

### Requirement: [已有需求名称]
[完整的修改后需求内容]

## REMOVED Requirements

### Requirement: [要移除的需求名称]
**Reason**: [移除原因]
**Migration**: [迁移方案]

## RENAMED Requirements
- FROM: `### Requirement: [旧名称]`
- TO: `### Requirement: [新名称]`
```

### 4.4 Tasks 文件格式 (`tasks.md`)

```markdown
# Tasks: [变更名称]

## 1. [阶段名称]
- [ ] 1.1 [任务描述]
- [ ] 1.2 [任务描述]
- [x] 1.3 [已完成的任务]

## 2. [下一阶段]
- [ ] 2.1 [任务描述]
```

## 5. 解析逻辑

### 5.1 Markdown 解析器

OpenSpec 使用自定义的 `MarkdownParser` 类解析 markdown 文件：

1. **Section 解析**：按标题层级构建树形结构
2. **Requirement 解析**：从 `## Requirements` 的子节点提取
3. **Scenario 解析**：从 Requirement 的子节点（`#### Scenario:`）提取
4. **Delta 解析**：识别 `## ADDED/MODIFIED/REMOVED/RENAMED Requirements` 部分

### 5.2 Change 解析器

`ChangeParser` 扩展了 `MarkdownParser`，增加了：

1. **Delta Specs 解析**：扫描 `changes/[id]/specs/` 目录
2. **合并策略**：优先使用 delta specs，fallback 到 proposal 中的简单格式

### 5.3 关键解析规则

| 元素 | 格式要求 |
|------|----------|
| Spec 标题 | `# [Name] Specification` |
| Purpose | `## Purpose` |
| Requirements | `## Requirements` |
| Requirement | `### Requirement: [Name]` |
| Scenario | `#### Scenario: [Name]` |
| Delta 操作 | `## ADDED/MODIFIED/REMOVED/RENAMED Requirements` |

## 6. 验证规则

### 6.1 Spec 验证

- `name` 不能为空
- `overview` (Purpose) 不能为空
- 至少有一个 requirement
- 每个 requirement 必须包含 `SHALL` 或 `MUST`
- 每个 requirement 至少有一个 scenario

### 6.2 Change 验证

- `name` 不能为空
- `why` 部分有最小/最大长度限制
- `whatChanges` 不能为空
- 至少有一个 delta
- delta 数量有上限

## 7. 三阶段工作流

### Stage 1: 创建变更 (Creating Changes)

1. 审查 `project.md` 和现有 specs
2. 选择唯一的 `change-id`（kebab-case，动词开头）
3. 创建 `proposal.md`、`tasks.md`、delta specs
4. 运行 `openspec validate [id] --strict`

### Stage 2: 实现变更 (Implementing Changes)

1. 阅读 `proposal.md` 理解要构建什么
2. 阅读 `design.md`（如果存在）
3. 按 `tasks.md` 顺序实现
4. 完成后更新任务状态为 `[x]`

### Stage 3: 归档变更 (Archiving Changes)

1. 移动 `changes/[name]/` → `changes/archive/YYYY-MM-DD-[name]/`
2. 更新 `specs/` 中的能力规格
3. 运行 `openspec validate --strict` 确认

## 8. 真实项目示例分析

基于 `/Users/kzf/Dev/GitHub/chain-services/openspec` 项目：

### 8.1 项目结构

```
openspec/
├── project.md          # Nilai Web3 电商平台上下文
├── AGENTS.md           # AI 助手指令
├── specs/              # 11 个能力规格
│   ├── account-analyzer-rwa-exchange/
│   ├── bfm-dex-levelup/
│   ├── combo-algorithm/
│   ├── combo-number/
│   ├── exchange-quota-admin-api/
│   ├── exchange-quota-admin-ui/
│   ├── exchange-quota-model/
│   ├── exchange-quota-validation/
│   ├── levelup-composite-deduction/
│   └── levelup-priority-deduction/
└── changes/
    ├── add-multi-chain-airdrop/  # 活跃变更
    └── archive/                   # 已归档变更
```

### 8.2 Spec 示例：combo-algorithm

```markdown
# combo-algorithm Specification

## Purpose
TBD - created by archiving change add-levelup-combo-algorithm.

## Requirements

### Requirement: ComboList-Based Combination Algorithm
The system SHALL provide a pure function `solveLevelUpCombination(rules, assets, targetValue)`...

#### Scenario: Honors ordering and constraints
- **WHEN** `solveLevelUpCombination` runs with a `comboList`...
- **THEN** it SHALL select assets in list order...

#### Scenario: Stops when target met or fails explicitly
- **WHEN** the accumulated `used` reaches `targetValue`
- **THEN** the algorithm SHALL stop...

#### Scenario: High-precision, side-effect free
- **WHEN** executing the function
- **THEN** all numeric operations SHALL use `big.js`...
```

### 8.3 Change 示例：add-multi-chain-airdrop

**proposal.md 结构：**
- Why: 当前空投功能硬编码使用 CCChain，需要支持多链
- What Changes: admin-service、admin-app、user-app 的多处修改
- Impact: 新增 `multi-chain-airdrop` 能力规格

**tasks.md 结构：**
- 13 个主要阶段
- 115+ 个具体任务
- 覆盖数据模型、API、UI、测试等

## 9. OpenSpecUI 与 OpenSpec CLI 的差异

### 9.1 当前 OpenSpecUI 实现

| 特性 | OpenSpec CLI | OpenSpecUI 当前实现 |
|------|-------------|-------------------|
| Spec 解析 | 完整的 Purpose/Requirements 解析 | 简化版本 |
| Change 解析 | 支持 delta specs 目录 | 仅解析 proposal.md |
| Tasks 解析 | 支持 checkbox 状态 | 支持 checkbox 状态 |
| 验证 | 完整的 Zod schema 验证 | 基础验证 |
| Delta 操作 | ADDED/MODIFIED/REMOVED/RENAMED | 支持 |

### 9.2 需要对齐的关键点

1. **Spec 名称解析**：应从 `# [Name] Specification` 标题提取，而非目录名
2. **Change 名称解析**：应从 `# Change: [Name]` 标题提取
3. **Delta Specs 解析**：需要扫描 `changes/[id]/specs/` 目录
4. **验证规则**：需要实现 SHALL/MUST 检查和 scenario 必需检查

## 10. 建议的改进方向

### 10.1 短期改进

1. **名称解析对齐**：从 markdown 标题提取 name，而非使用目录名
2. **Delta Specs 支持**：解析 `changes/[id]/specs/` 目录中的 delta 文件
3. **验证增强**：添加 SHALL/MUST 和 scenario 必需检查

### 10.2 中期改进

1. **完整的 Change 视图**：展示 proposal + tasks + delta specs
2. **任务进度追踪**：按阶段展示任务完成情况
3. **验证报告**：详细的验证错误和警告展示

### 10.3 长期改进

1. **归档功能**：支持将完成的 change 归档
2. **Spec 合并**：将 delta 合并到主 spec
3. **冲突检测**：检测多个 change 之间的冲突

---

*报告生成时间：2025-11-28*
*基于 OpenSpec CLI 源码和 chain-services 项目分析*
