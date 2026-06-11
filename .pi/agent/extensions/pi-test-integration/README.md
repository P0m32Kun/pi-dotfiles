# pi-test-integration

测试框架集成扩展，支持 Vitest、Jest 和 Pytest，提供测试运行、覆盖率分析和失败分析功能。

## 核心功能

### 1. 测试框架自动检测

自动检测项目使用的测试框架：
- **Vitest**: 检测 `vitest.config.ts`、`vite.config.ts` 等配置文件
- **Jest**: 检测 `jest.config.js`、`jest.config.ts` 等配置文件
- **Pytest**: 检测 `pytest.ini`、`pyproject.toml`、`setup.cfg` 等配置文件

### 2. 测试运行

运行项目测试，支持：
- 指定测试文件模式
- 遇到失败立即停止 (bail)
- 自定义超时时间

### 3. 失败分析

分析测试失败原因，提供修复建议：
- 断言错误分析
- 类型错误分析
- 引用错误分析
- 语法错误分析
- 超时错误分析

### 4. 覆盖率分析 (实验性)

生成覆盖率报告，支持：
- 行覆盖率
- 函数覆盖率
- 分支覆盖率
- 语句覆盖率

## 工具

### test_run

运行项目测试。

```javascript
test_run({
  pattern: "auth.test.ts",  // 可选: 测试文件匹配模式
  framework: "vitest",       // 可选: 指定测试框架
  bail: true,                // 可选: 遇到失败立即停止
  timeout: 30000             // 可选: 超时时间 (ms)
})
```

### test_analyze

分析测试失败原因。

```javascript
test_analyze({
  testName: "should authenticate user",
  error: "expected 1 to equal 2",
  stack: "...",
  file: "auth.test.ts"
})
```

### test_framework

检测项目使用的测试框架。

```javascript
test_framework({
  path: "/path/to/project"  // 可选: 项目路径
})
```

## 命令

```
/test run              # 运行测试
/test analyze          # 分析测试失败
/test framework        # 检测测试框架
```

## 配置

```json
{
  "enabled": true,
  "defaultFramework": "auto",
  "frameworks": {
    "vitest": {
      "enabled": true,
      "configFiles": ["vitest.config.ts", "vitest.config.js", "vite.config.ts"]
    },
    "jest": {
      "enabled": true,
      "configFiles": ["jest.config.js", "jest.config.ts"]
    },
    "pytest": {
      "enabled": true,
      "configFiles": ["pytest.ini", "pyproject.toml", "setup.cfg"]
    }
  },
  "analysis": {
    "enabled": true,
    "maxSuggestions": 5
  },
  "coverage": {
    "enabled": false,
    "threshold": {
      "lines": 80,
      "functions": 80,
      "branches": 80,
      "statements": 80
    }
  }
}
```

## 支持的测试框架

| 框架 | 检测 | 运行 | 覆盖率 | 失败分析 |
|------|------|------|--------|----------|
| Vitest | ✅ | ✅ | ❌ | ✅ |
| Jest | ✅ | ✅ | ❌ | ✅ |
| Pytest | ✅ | ✅ | ❌ | ✅ |

## 失败分析示例

### 断言错误

```
输入: expected 1 to equal 2
输出:
- 根本原因: Assertion error: expected 1 to equal 2
- 修复建议: Expected 2 but got 1. Check your test assertions.
- 置信度: 90%
```

### 类型错误

```
输入: TypeError: Cannot read property "foo" of undefined
输出:
- 根本原因: Accessing property of undefined
- 修复建议: Ensure the object is defined before accessing its properties. Use optional chaining (?.) or null checks.
- 置信度: 85%
```

### 引用错误

```
输入: ReferenceError: myVar is not defined
输出:
- 根本原因: Variable "myVar" is not defined
- 修复建议: Ensure "myVar" is imported or declared before use. Check for typos in variable names.
- 置信度: 90%
```

## 文件结构

```
pi-test-integration/
├── index.ts              # 扩展入口
├── types.ts              # 类型定义
├── adapters.ts           # 测试框架适配器
├── analyzer.ts           # 失败分析器
├── config.json           # 配置
└── README.md             # 文档
```

## 测试

```bash
npm test
```

测试覆盖：
- 适配器: 14 tests
- 分析器: 5 tests

**总计: 19 tests**
