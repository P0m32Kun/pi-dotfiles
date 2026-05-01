---
name: cap-commit-push
description: |
  AI-powered intelligent Git commit workflow. Generates conventional commits,
  supports hunk-level staging for atomic commits, auto-updates CHANGELOG,
  validates commit messages, and optionally pushes. Use when the user says
  "commit", "提交", "push", "提交代码", or when completing a coding task.
---

# Cap Commit Push

智能 Git 提交工作流：分析变更 → 拆分原子提交 → 生成 conventional commit → 可选 push。

## When This Triggers

- 用户说 "commit"、"提交"、"提交代码"
- 用户说 "push"、"推送"
- 完成一个编码任务后需要提交
- 用户要求查看当前 git 状态并提交

## Workflow

### Step 1: 收集状态

```bash
git status --porcelain
git diff --stat
git diff
git log --oneline -5
```

如果 `git status` 显示没有变更，告知用户并退出。

如果只有 staged 变更（`git diff --cached --stat` 非空），跳到 Step 3。

### Step 2: 分析与规划

分析 diff 语义，将变更按**逻辑相关性**分组：

**拆分原则：**
- 同一个功能/bug 的代码改动 + 测试 = 1 个 commit
- 不相关的改动（如 typo fix + feature）= 拆成多个 commit
- 大规模重构中混入的 bug fix = 先单独提交 fix，再提交 refactor

**不要拆分的情况：**
- 紧密耦合的改动（同一个函数的签名变更 + 调用方更新）
- 纯重构（所有文件都是同一个重构的一部分）

向用户简述拆分计划，如："我打算拆成 2 个 commit：1) feat(auth): 添加 token 验证  2) test(auth): 补充边界测试"

### Step 3: 逐个原子提交

对每个 commit 组：

**3a. 暂存变更**

对于简单情况（整个文件属于同一个 commit）：
```bash
git add <files>
```

对于需要 hunk 级暂存的情况（同一个文件包含多个不相关改动）：
```bash
# 解析可用的 hunk
bash ~/.agents/skills/cap-commit-push/scripts/parse-hunks.sh <file>

# 生成并暂存特定 hunk（注意需要 --unidiff-zero）
bash ~/.agents/skills/cap-commit-push/scripts/parse-hunks.sh <file> --apply 1,3 | git apply --cached --unidiff-zero
```

**3b. 生成 Conventional Commit Message**

格式：
```
<type>(<scope>): <description>

[optional body: WHY this change, not WHAT]

[optional footer]
```

类型选择（按优先级）：
| type | 何时使用 |
|------|---------|
| `feat` | 新功能、新能力 |
| `fix` | Bug 修复 |
| `refactor` | 重构（不改变外部行为） |
| `perf` | 性能优化 |
| `test` | 添加/修改测试 |
| `docs` | 文档变更 |
| `ci` | CI/CD 配置 |
| `build` | 构建系统、依赖 |
| `style` | 代码风格（格式化、空格等） |
| `chore` | 其他杂项 |

规则：
- description：英文，小写开头，不加句号，不超过 72 字符
- scope：小写，可选，反映变更范围（模块名、文件名等）
- body：解释 WHY 而非 WHAT，可以用中文
- BREAKING CHANGE：用 `!` 后缀（如 `feat(api)!:`）或 footer 中写 `BREAKING CHANGE: ...`

**3c. 提交**
```bash
git commit -m "type(scope): description"  # 单行
# 或
git commit -m "type(scope): description" -m "body text"  # 带 body
```

**3d. 质量检查**

提交前检查：
- [ ] 不包含 filler 词："update code", "fix stuff", "misc changes", "various improvements"
- [ ] 不包含 AI 痕迹："as an AI", "I've", "this commit will"
- [ ] type 正确区分 feat/fix/refactor
- [ ] scope 准确反映实际变更范围
- [ ] description 简洁明确，不是重复 diff 内容

### Step 4: CHANGELOG 更新（可选）

条件：项目根目录存在 CHANGELOG.md，且本次有 `feat` 或 `fix` 类型的提交。

操作：
1. 找到 `## [Unreleased]` 或文件顶部
2. 追加：`- **type(scope)**: description`
3. git add CHANGELOG.md && git commit -m "docs: update CHANGELOG"

### Step 5: Push（按需）

**只在用户明确要求时 push**（说了"push"、"推送"、"提交并推送"等）。

```bash
# 先 rebase 确保没有冲突
git pull --rebase

# push
git push

# 如果没有 upstream tracking
git push -u origin <current-branch>
```

push 前告知用户将要推送的内容，等待确认。

## 常见场景速查

| 场景 | 操作 |
|------|------|
| 用户说"提交" | 执行 Step 1-3，不 push |
| 用户说"提交并推送" | 执行 Step 1-5 |
| 用户说"提交但拆开" | 执行 Step 1-3，重点做 Step 2 的拆分分析 |
| 用户只改了一个文件 | 整个文件 git add，不需要 hunk staging |
| 用户改了很多文件但都是同一个功能 | 一个 commit |
| 用户说"看看有什么可提交的" | 只执行 Step 1，展示状态 |
