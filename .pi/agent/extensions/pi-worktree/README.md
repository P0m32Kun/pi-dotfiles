# pi-worktree

Git Worktree 隔离扩展，为并行代理执行提供隔离的工作目录。

## 核心功能

### 1. 创建 Worktree

```javascript
worktree_create({
  branch: "feature-auth",
  baseBranch: "main"
})
```

### 2. 列出 Worktree

```javascript
worktree_list({})
```

### 3. 清理 Worktree

```javascript
// 清理指定 Worktree
worktree_cleanup({ path: ".worktrees/feature-auth" })

// 清理所有已完成的
worktree_cleanup({})
```

### 4. 合并分支

```javascript
worktree_merge({
  path: ".worktrees/feature-auth",
  target: "main"
})
```

## 命令

```
/worktree create <branch>  # 创建 Worktree
/worktree list             # 列出所有 Worktree
/worktree cleanup          # 清理已完成的 Worktree
/worktree merge            # 合并分支
```

## 配置

```json
{
  "enabled": true,
  "basePath": ".worktrees",
  "defaultBaseBranch": "main",
  "autoCleanup": true,
  "maxWorktrees": 10
}
```

## 使用场景

### 并行开发

```javascript
// 为每个代理创建独立 Worktree
const authWorktree = await worktree_create({ branch: "feature-auth" });
const testWorktree = await worktree_create({ branch: "feature-tests" });

// 代理在各自 Worktree 中工作
// ...

// 完成后合并
await worktree_merge({ path: authWorktree.path, target: "main" });
await worktree_merge({ path: testWorktree.path, target: "main" });

// 清理
await worktree_cleanup({});
```

## 文件结构

```
pi-worktree/
├── index.ts        # 扩展入口
├── types.ts        # 类型定义
├── worktree.ts     # 核心实现
├── config.json     # 配置
└── README.md       # 文档
```

## 测试

```bash
npm test
```

测试覆盖: 6 tests
