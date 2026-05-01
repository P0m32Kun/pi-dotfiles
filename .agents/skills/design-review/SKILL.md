---
name: design-review
description: |
  多模型并行设计评审工作流。当用户提交一份设计方案（功能设计、架构方案、技术选型文档等），自动并行分发给多个配置的 AI 模型进行独立评审，收集各模型的分析、优化建议和补充意见，最终汇总为一份可实施的实施方案。
  当用户提到"评审方案"、"多模型评审"、"design review"、"review my design"、"让多个模型看看这个方案"、"帮我评审一下设计文档"时，必须使用此 skill。
---

# Design Review — 多模型并行设计评审

## 触发条件

- 用户提交了设计方案，要求多模型评审
- 用户说"帮我看看这个方案"、"评审一下设计"、"让多个模型分析一下"
- 用户明确提到使用 kimi/glm/mimo/deepseek 等模型评审
- 任何涉及设计方案评审、优化、补充、形成实施方案的场景

## 文档位置约定

参考 `doc-archivist` 的文档归档规范，评审工作流使用以下目录结构：

```
docs/
├── active/
│   ├── design/          # 原始设计方案（用户编写）
│   │   └── {design-name}.md
│   ├── review/          # 各模型评审意见
│   │   └── {design-name}/
│   │       ├── {model-label}.md
│   │       └── ...
│   └── plan/            # 最终可实施的实施方案
│       └── implementation-plan-{design-name}.md
```

### 文件命名规则
- **设计方案**：`docs/active/design/{design-name}.md`
- **评审意见**：`docs/active/review/{design-name}/{model-label}.md`
- **实施方案**：`docs/active/plan/implementation-plan-{design-name}.md`

### 目录创建
如果目录不存在，工作流会自动创建。如果 `docs/` 目录整体不存在，先创建 `docs/active/` 下的各子目录。

## 模型配置

评审模型列表存储在配置文件：

```
~/.agents/skills/design-review/config/models.json
```

### 默认配置

```json
{
  "models": [
    { "id": "kimi", "model": "kimi-coding/kimi-for-coding", "label": "kimi-coding" },
    { "id": "glm", "model": "zai/glm-5.1", "label": "glm-5.1" },
    { "id": "mimo", "model": "mimo/mimo-v2.5-pro", "label": "mimo-v2.5-pro" },
    { "id": "deepseek", "model": "deepseek/deepseek-v4-pro", "label": "deepseek-v4-pro" }
  ]
}
```

### 修改模型配置

用户可随时编辑 `models.json`：
- **更换模型**：修改 `model` 字段为其他模型 ID
- **增减模型**：添加或删除 `models` 数组中的条目
- **修改标签**：`label` 字段用于输出文件名和报告引用

例如临时只用两个模型：
```json
{
  "models": [
    { "id": "deepseek", "model": "deepseek/deepseek-v4-pro", "label": "deepseek-v4-pro" },
    { "id": "kimi", "model": "kimi-coding/kimi-for-coding", "label": "kimi-coding" }
  ]
}
```

Skill 执行时会先读取此配置文件；若文件不存在或解析失败，回退到上述默认配置。

## 工作流

### Step 1: 读取方案与配置

1. **确定设计文档**：
   - 若用户明确指定了文件路径，直接使用
   - 若用户未指定，扫描 `docs/active/design/` 目录，按修改时间取最新的 `.md` 文件
   - 若该目录为空，提示用户先创建设计文档或明确指定路径

2. **读取模型配置**：
   ```typescript
   read({ path: "~/.agents/skills/design-review/config/models.json" })
   ```
   解析 `models` 数组，提取 `model`（调用模型）和 `label`（输出标识）。

3. **创建输出目录**：
   ```typescript
   bash({ command: "mkdir -p docs/active/review/{design-name} docs/active/plan" })
   ```

### Step 2: 并行评审

使用 `subagent` PARALLEL mode，为每个配置的模型启动独立评审任务。

评审 agent 使用 `tech-advisor`（技术顾问角色，专注架构评估和建议，不写实现代码），通过 `model` 字段覆盖底层模型。

```typescript
const models = /* 从 models.json 读取 */;
const designFile = /* 用户指定的设计文档路径 */;
const designName = /* 从文件名提取，如 auth-refactor */;

subagent({
  tasks: models.map(m => ({
    agent: "tech-advisor",
    model: m.model,
    task: `请以技术架构师视角，对以下设计方案进行全面评审。

## 方案文件
${designFile}

## 评审维度
1. **方案完整性**：是否覆盖所有必要功能点、边界条件、异常处理
2. **技术可行性**：技术选型是否合理，是否存在已知风险或兼容性问题
3. **架构合理性**：模块划分、接口设计、数据流是否清晰，耦合度是否适当
4. **可维护性**：代码组织、测试策略、文档是否到位，团队能否长期维护
5. **安全性**：是否有安全漏洞、权限控制缺陷、数据保护不足
6. **性能与扩展性**：是否有性能瓶颈、扩展性限制、资源浪费
7. **优化与补充**：如何改进、简化、补充方案，遗漏了哪些关键考虑

## 输出要求
- 逐条列出发现的问题和风险（按严重程度分级：阻塞/高/中/低）
- 给出具体的优化建议（附代码/配置示例更佳）
- 指出方案中遗漏或未考虑到的关键点
- 给出整体评分（1-10 分）和简要结论
- 如有独特见解或差异化视角，单独标注

将完整评审意见写入文件：docs/active/review/${designName}/${m.label}.md`,
    output: `docs/active/review/${designName}/${m.label}.md`,
    context: "fresh"
  })),
  concurrency: models.length
})
```

**关键约束：**
- 每个评审任务使用 `context: "fresh"`，确保各模型独立评审，不受其他模型影响
- 每个任务输出到独立文件，避免并行写入冲突
- `concurrency` 设为模型数量，一次性全部启动

### Step 3: 汇总实施方案

所有评审任务完成后，启动汇总 agent 生成最终可实施方案。

```typescript
subagent({
  agent: "planner",
  task: `请基于以下多模型评审意见，汇总生成一份结构化的最终可实施方案。

## 输入
- 原始设计方案：${designFile}
- 评审意见目录：docs/active/review/${designName}/

## 任务
1. 读取该目录下所有评审意见文件
2. **合并共识性意见**：所有模型都提到的问题必须列入待办，标注"共识"
3. **整合差异化建议**：各模型独特的视角和建议单独标注来源模型
4. **冲突消解**：若不同模型建议冲突，分析优劣并给出推荐选择及理由
5. **去重排序**：按优先级（阻塞 > 高 > 中 > 低）排列所有待办事项
6. **形成实施方案**，包含：
   - 执行摘要（方案核心 + 各模型评分概览）
   - 共识问题清单（必须解决）
   - 差异化建议清单（可选采纳）
   - 执行步骤（按优先级排序，每条含负责人/模块建议）
   - 风险缓解措施
   - 验收标准
   - 时间估算（如有）

## 输出要求
- 写入文件：docs/active/plan/implementation-plan-${designName}.md
- 格式清晰，使用 Markdown 标题层级
- 每条建议标注来源模型和优先级`,
  output: `docs/active/plan/implementation-plan-${designName}.md`,
  context: "fork"
})
```

### Step 4: 向用户汇报

汇总完成后，向用户输出结构化汇报：

```
## 多模型设计评审完成 ✅

### 参与评审的模型
| 模型 | 评分 | 关键结论 |
|------|------|----------|
| kimi-coding | X/10 | ... |
| glm-5.1 | X/10 | ... |
| mimo-v2.5-pro | X/10 | ... |
| deepseek-v4-pro | X/10 | ... |

### 共识问题（所有模型一致指出）
1. ...
2. ...

### 独特视角
- **kimi-coding**: ...
- **glm-5.1**: ...
- **mimo-v2.5-pro**: ...
- **deepseek-v4-pro**: ...

### 输出文件
- 评审意见：`docs/active/review/{design-name}/`
- 实施方案：`docs/active/plan/implementation-plan-{design-name}.md`

### 建议下一步
1. 审阅实施方案，确认优先级和范围
2. 如需调整，修改设计文档后重新运行评审
3. 确认后按实施方案分步执行
```

## 注意事项

- **独立评审**：每个模型必须使用 `context: "fresh"`，避免模型间互相影响
- **文件隔离**：并行任务输出到不同文件，禁止两个模型写入同一文件
- **模型失效处理**：若某个模型调用失败（如订阅到期），跳过该模型并在汇报中注明
- **重复评审**：若用户多次评审同一方案，新评审会覆盖旧文件；如需保留历史，手动重命名旧文件
- **适用范围**：此 skill 适用于技术方案、架构设计、功能设计文档；不适用于纯代码审查（用 `code-review-and-quality` skill）
