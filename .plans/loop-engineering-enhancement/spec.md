# Loop Engineering 增强技术规格

## 概述

本文档定义了 Loop Engineering 增强功能的技术规格，包括 VISION.md 机制、Hooks 系统、自动化触发器、Git Worktrees 隔离、对抗验证和安全审计。

---

## 1. VISION.md 机制

### 1.1 接口定义

```typescript
interface Vision {
  goals: string[];           // 项目目标
  constraints: string[];     // 约束条件
  currentPhase: string;      // 当前阶段
  forbidden: string[];       // 禁止事项
  metadata?: Record<string, unknown>;
}

interface DriftResult {
  drifted: boolean;          // 是否偏离目标
  reason?: string;           // 偏离原因
  suggestion?: string;       // 建议
  confidence: number;        // 置信度 0-1
}

interface VisionManager {
  // 加载 VISION.md
  load(path?: string): Promise<Vision>;
  
  // 检查目标漂移
  checkDrift(task: string, context?: Record<string, unknown>): Promise<DriftResult>;
  
  // 注入到系统提示
  injectToPrompt(vision: Vision): string;
  
  // 保存 VISION.md
  save(vision: Vision, path?: string): Promise<void>;
}
```

### 1.2 文件格式

```markdown
# VISION.md

## 项目目标
[目标描述]

## 约束条件
- [约束 1]
- [约束 2]

## 当前阶段
[阶段描述]

## 禁止事项
- [禁止 1]
- [禁止 2]

## 元数据
- 创建时间: [日期]
- 最后更新: [日期]
- 负责人: [姓名]
```

### 1.3 漂移检测算法

```typescript
function checkDrift(task: string, vision: Vision): DriftResult {
  const taskLower = task.toLowerCase();
  
  // 检查是否违反禁止事项
  for (const forbidden of vision.forbidden) {
    if (taskLower.includes(forbidden.toLowerCase())) {
      return {
        drifted: true,
        reason: `违反禁止事项: ${forbidden}`,
        suggestion: `请避免 ${forbidden}`,
        confidence: 0.9
      };
    }
  }
  
  // 检查是否符合约束条件
  for (const constraint of vision.constraints) {
    if (!checkConstraint(task, constraint)) {
      return {
        drifted: true,
        reason: `违反约束: ${constraint}`,
        suggestion: `请遵守约束: ${constraint}`,
        confidence: 0.7
      };
    }
  }
  
  // 检查是否符合当前阶段
  if (!checkPhase(task, vision.currentPhase)) {
    return {
      drifted: true,
      reason: `任务不属于当前阶段: ${vision.currentPhase}`,
      suggestion: `请专注于当前阶段: ${vision.currentPhase}`,
      confidence: 0.6
    };
  }
  
  return { drifted: false, confidence: 1.0 };
}
```

---

## 2. Hooks 系统

### 2.1 接口定义

```typescript
type HookType = 
  | 'before_loop'      // 循环开始前
  | 'after_loop'       // 循环结束后
  | 'before_tool_call' // 工具调用前
  | 'after_tool_call'  // 工具调用后
  | 'on_error'         // 错误发生时
  | 'before_commit'    // 提交前
  | 'after_commit'     // 提交后
  | 'before_agent'     // 代理开始前
  | 'after_agent'      // 代理结束后;

interface HookContext {
  type: HookType;
  task: string;
  state: LoopState;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  error?: Error;
  metadata?: Record<string, unknown>;
}

interface HookResult {
  continue: boolean;     // 是否继续执行
  message?: string;      // 消息
  inject?: string;       // 注入到上下文
  modify?: Record<string, unknown>; // 修改参数
}

interface Hook {
  name: string;
  type: HookType | HookType[];
  priority: number;      // 优先级，数字越小越先执行
  execute: (context: HookContext) => Promise<HookResult>;
}

interface HookSystem {
  // 注册 Hook
  register(hook: Hook): void;
  
  // 注销 Hook
  unregister(name: string): void;
  
  // 执行 Hook
  execute(type: HookType, context: Omit<HookContext, 'type'>): Promise<HookResult[]>;
  
  // 列出所有 Hook
  list(): Hook[];
  
  // 启用/禁用 Hook
  enable(name: string): void;
  disable(name: string): void;
}
```

### 2.2 内置 Hook

```typescript
// VISION.md 检查 Hook
const visionCheckHook: Hook = {
  name: 'vision-check',
  type: 'before_loop',
  priority: 10,
  execute: async (context) => {
    const vision = await visionManager.load();
    const drift = await visionManager.checkDrift(context.task, vision);
    
    if (drift.drifted) {
      return {
        continue: false,
        message: `目标漂移检测: ${drift.reason}`
      };
    }
    
    return { continue: true };
  }
};

// 安全检查 Hook
const securityCheckHook: Hook = {
  name: 'security-check',
  type: 'before_tool_call',
  priority: 20,
  execute: async (context) => {
    if (context.toolName === 'bash') {
      const command = context.toolArgs?.command as string;
      const result = securityAuditor.checkCommandSafety(command);
      
      if (!result.safe) {
        return {
          continue: false,
          message: `安全检查失败: ${result.errors.join(', ')}`
        };
      }
    }
    
    return { continue: true };
  }
};

// 状态保存 Hook
const stateSaveHook: Hook = {
  name: 'state-save',
  type: 'after_loop',
  priority: 100,
  execute: async (context) => {
    await agentmemory.save({
      content: `循环完成: ${context.task}`,
      type: 'loop_state'
    });
    
    return { continue: true };
  }
};
```

---

## 3. 自动化触发器

### 3.1 接口定义

```typescript
type TriggerType = 'cron' | 'event' | 'file';

interface CronConfig {
  schedule: string;        // Cron 表达式: '*/5 * * * *'
  timezone?: string;
}

interface EventConfig {
  source: 'git' | 'github' | 'issue' | 'custom';
  event: string;           // 'push', 'pull_request', 'issue_created'
  filter?: Record<string, unknown>;
}

interface FileConfig {
  paths: string[];
  pattern: string;
  debounce?: number;       // 防抖时间 ms
}

interface TriggerConfig {
  type: TriggerType;
  name: string;
  enabled: boolean;
  config: CronConfig | EventConfig | FileConfig;
  task: string;            // 要执行的任务
  stopCondition?: () => Promise<boolean>;
  maxRuns?: number;        // 最大运行次数
}

interface TriggerResult {
  success: boolean;
  trigger: string;
  task: string;
  output?: unknown;
  error?: string;
  duration: number;
}

interface AutomationTriggerManager {
  // 注册触发器
  register(config: TriggerConfig): void;
  
  // 注销触发器
  unregister(name: string): void;
  
  // 启用/禁用触发器
  enable(name: string): void;
  disable(name: string): void;
  
  // 手动触发
  trigger(name: string): Promise<TriggerResult>;
  
  // 列出所有触发器
  list(): TriggerConfig[];
  
  // 启动所有触发器
  start(): Promise<void>;
  
  // 停止所有触发器
  stop(): Promise<void>;
}
```

### 3.2 Cron 调度实现

```typescript
class CronTrigger {
  private schedule: string;
  private task: () => Promise<void>;
  private timer?: NodeJS.Timer;

  constructor(schedule: string, task: () => Promise<void>) {
    this.schedule = schedule;
    this.task = task;
  }

  start(): void {
    // 解析 cron 表达式
    const interval = this.parseCron(this.schedule);
    
    this.timer = setInterval(async () => {
      try {
        await this.task();
      } catch (error) {
        console.error('Cron trigger error:', error);
      }
    }, interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private parseCron(schedule: string): number {
    // 简单实现：支持 '*/N' 格式
    const match = schedule.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    if (match) {
      return parseInt(match[1]) * 60 * 1000;
    }
    return 60 * 1000; // 默认 1 分钟
  }
}
```

### 3.3 事件触发实现

```typescript
class EventTrigger {
  private source: string;
  private event: string;
  private task: (event: unknown) => Promise<void>;

  constructor(source: string, event: string, task: (event: unknown) => Promise<void>) {
    this.source = source;
    this.event = event;
    this.task = task;
  }

  async start(): Promise<void> {
    switch (this.source) {
      case 'git':
        await this.startGitWatcher();
        break;
      case 'github':
        await this.startGitHubWebhook();
        break;
      case 'issue':
        await this.startIssueWatcher();
        break;
    }
  }

  private async startGitWatcher(): Promise<void> {
    // 使用 chokidar 监控 .git 目录
    const watcher = chokidar.watch('.git/refs', {
      ignoreInitial: true
    });

    watcher.on('change', async (path) => {
      await this.task({ type: 'git', path });
    });
  }

  private async startGitHubWebhook(): Promise<void> {
    // 启动 HTTP 服务器接收 webhook
    const server = http.createServer(async (req, res) => {
      if (req.method === 'POST') {
        const body = await this.readBody(req);
        await this.task(JSON.parse(body));
        res.writeHead(200);
        res.end('OK');
      }
    });

    server.listen(9876);
  }

  private async startIssueWatcher(): Promise<void> {
    // 使用 GitHub API 轮询 issue
    setInterval(async () => {
      const issues = await this.fetchNewIssues();
      for (const issue of issues) {
        await this.task(issue);
      }
    }, 60000); // 每分钟检查一次
  }
}
```

---

## 4. Git Worktrees 隔离

### 4.1 接口定义

```typescript
interface Worktree {
  path: string;
  branch: string;
  head: string;
  createdAt: Date;
  status: 'active' | 'completed' | 'failed';
}

interface WorktreeManager {
  // 创建 worktree
  create(options: WorktreeCreateOptions): Promise<Worktree>;
  
  // 清理 worktree
  cleanup(worktree: Worktree): Promise<void>;
  
  // 清理所有已完成的 worktree
  cleanupAll(): Promise<void>;
  
  // 列出所有 worktree
  list(): Promise<Worktree[]>;
  
  // 合并分支
  merge(worktree: Worktree, target: string): Promise<void>;
  
  // 获取状态
  getStatus(worktree: Worktree): Promise<WorktreeStatus>;
}

interface WorktreeCreateOptions {
  branch: string;
  baseBranch?: string;    // 默认 'main'
  path?: string;          // 自动生成
  env?: Record<string, string>;
}

interface WorktreeStatus {
  branch: string;
  ahead: number;          // 领先主分支的提交数
  behind: number;         // 落后主分支的提交数
  dirty: boolean;         // 是否有未提交的更改
  files: string[];        // 修改的文件列表
}
```

### 4.2 实现

```typescript
class GitWorktreeManager implements WorktreeManager {
  private basePath: string;

  constructor(basePath: string = '.worktrees') {
    this.basePath = basePath;
  }

  async create(options: WorktreeCreateOptions): Promise<Worktree> {
    const branch = options.branch;
    const baseBranch = options.baseBranch || 'main';
    const path = options.path || path.join(this.basePath, branch);

    // 创建分支
    await exec(`git branch ${branch} ${baseBranch}`);
    
    // 创建 worktree
    await exec(`git worktree add ${path} ${branch}`);

    return {
      path,
      branch,
      head: await this.getHead(path),
      createdAt: new Date(),
      status: 'active'
    };
  }

  async cleanup(worktree: Worktree): Promise<void> {
    // 删除 worktree
    await exec(`git worktree remove ${worktree.path}`);
    
    // 删除分支（可选）
    // await exec(`git branch -d ${worktree.branch}`);
  }

  async cleanupAll(): Promise<void> {
    const worktrees = await this.list();
    for (const worktree of worktrees) {
      if (worktree.status !== 'active') {
        await this.cleanup(worktree);
      }
    }
  }

  async list(): Promise<Worktree[]> {
    const output = await exec('git worktree list --porcelain');
    return this.parseWorktreeList(output);
  }

  async merge(worktree: Worktree, target: string): Promise<void> {
    // 切换到目标分支
    await exec(`git checkout ${target}`);
    
    // 合并 worktree 分支
    await exec(`git merge ${worktree.branch} --no-ff`);
    
    // 更新 worktree 状态
    worktree.status = 'completed';
  }

  async getStatus(worktree: Worktree): Promise<WorktreeStatus> {
    const output = await exec(`git -C ${worktree.path} status --porcelain`);
    const files = this.parseStatus(output);

    return {
      branch: worktree.branch,
      ahead: await this.getAheadCount(worktree),
      behind: await this.getBehindCount(worktree),
      dirty: files.length > 0,
      files
    };
  }

  private async getHead(path: string): Promise<string> {
    const output = await exec(`git -C ${path} rev-parse HEAD`);
    return output.trim();
  }

  private async getAheadCount(worktree: Worktree): Promise<number> {
    const output = await exec(
      `git -C ${worktree.path} rev-list --count HEAD..origin/main`
    );
    return parseInt(output.trim());
  }

  private async getBehindCount(worktree: Worktree): Promise<number> {
    const output = await exec(
      `git -C ${worktree.path} rev-list --count origin/main..HEAD`
    );
    return parseInt(output.trim());
  }

  private parseWorktreeList(output: string): Worktree[] {
    // 解析 git worktree list --porcelain 输出
    const worktrees: Worktree[] = [];
    // ... 解析逻辑
    return worktrees;
  }

  private parseStatus(output: string): string[] {
    // 解析 git status --porcelain 输出
    const files: string[] = [];
    // ... 解析逻辑
    return files;
  }
}
```

---

## 5. 对抗验证

### 5.1 接口定义

```typescript
interface Agent {
  name: string;
  model: string;
  systemPrompt: string;
  execute(task: string): Promise<string>;
}

interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  suggestion: string;
  line?: number;
  file?: string;
}

interface ValidationResult {
  approved: boolean;
  findings: Finding[];
  iterations: number;
  duration: number;
}

interface AdversarialValidator {
  // 生成代理
  generator: Agent;
  
  // 审查代理
  reviewer: Agent;
  
  // 最大迭代次数
  maxIterations: number;
  
  // 执行对抗验证
  validate(task: string): Promise<ValidationResult>;
}
```

### 5.2 实现

```typescript
class AdversarialValidatorImpl implements AdversarialValidator {
  generator: Agent;
  reviewer: Agent;
  maxIterations: number;

  constructor(
    generator: Agent,
    reviewer: Agent,
    maxIterations: number = 3
  ) {
    this.generator = generator;
    this.reviewer = reviewer;
    this.maxIterations = maxIterations;
  }

  async validate(task: string): Promise<ValidationResult> {
    const startTime = Date.now();
    let iterations = 0;
    let currentCode = '';
    let findings: Finding[] = [];

    while (iterations < this.maxIterations) {
      iterations++;

      // 1. 生成代码
      const generatePrompt = iterations === 1
        ? task
        : `${task}\n\n之前的代码:\n${currentCode}\n\n请修复以下问题:\n${findings.map(f => `- ${f.description}`).join('\n')}`;

      currentCode = await this.generator.execute(generatePrompt);

      // 2. 审查代码
      const reviewPrompt = `请审查以下代码，找出问题:\n\n${currentCode}`;
      const reviewResult = await this.reviewer.execute(reviewPrompt);

      // 3. 解析审查结果
      findings = this.parseFindings(reviewResult);

      // 4. 如果没有问题，通过
      if (findings.length === 0 || 
          findings.every(f => f.severity === 'low')) {
        return {
          approved: true,
          findings,
          iterations,
          duration: Date.now() - startTime
        };
      }
    }

    // 达到最大迭代次数
    return {
      approved: false,
      findings,
      iterations,
      duration: Date.now() - startTime
    };
  }

  private parseFindings(reviewResult: string): Finding[] {
    // 解析审查结果
    const findings: Finding[] = [];
    // ... 解析逻辑
    return findings;
  }
}
```

---

## 6. 安全审计

### 6.1 接口定义

```typescript
interface ScanResult {
  vulnerabilities: Vulnerability[];
  score: number;           // 0-100
  timestamp: Date;
}

interface Vulnerability {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  file: string;
  line: number;
  fix?: string;
}

interface CredentialReport {
  found: boolean;
  credentials: Credential[];
}

interface Credential {
  type: 'api_key' | 'password' | 'token' | 'secret';
  file: string;
  line: number;
  masked: string;          // 脱敏后的值
}

interface PermissionReport {
  issues: PermissionIssue[];
}

interface PermissionIssue {
  type: string;
  description: string;
  file: string;
  recommendation: string;
}

interface SecurityAuditor {
  // SAST 扫描
  scanSAST(code: string, language?: string): Promise<ScanResult>;
  
  // 凭证检测
  detectCredentials(code: string): CredentialReport;
  
  // 权限审计
  auditPermissions(): Promise<PermissionReport>;
  
  // 日志脱敏
  sanitizeLogs(logs: string): string;
  
  // 命令安全检查
  checkCommandSafety(command: string): CommandSafetyResult;
}
```

### 6.2 实现

```typescript
class SecurityAuditorImpl implements SecurityAuditor {
  // 凭证模式
  private credentialPatterns = [
    { type: 'api_key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([^'"]+)['"]/gi },
    { type: 'password', pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]+)['"]/gi },
    { type: 'token', pattern: /(?:token|access[_-]?token)\s*[:=]\s*['"]([^'"]+)['"]/gi },
    { type: 'secret', pattern: /(?:secret|secret[_-]?key)\s*[:=]\s*['"]([^'"]+)['"]/gi }
  ];

  // 危险命令模式
  private dangerousCommands = [
    'rm -rf',
    'mkfs',
    'dd',
    'format',
    '> /dev/',
    'chmod 777',
    'curl | bash',
    'wget | bash'
  ];

  async scanSAST(code: string, language?: string): Promise<ScanResult> {
    const vulnerabilities: Vulnerability[] = [];

    // 检测 SQL 注入
    vulnerabilities.push(...this.detectSQLInjection(code));

    // 检测 XSS
    vulnerabilities.push(...this.detectXSS(code));

    // 检测路径遍历
    vulnerabilities.push(...this.detectPathTraversal(code));

    // 检测命令注入
    vulnerabilities.push(...this.detectCommandInjection(code));

    // 计算分数
    const score = this.calculateScore(vulnerabilities);

    return {
      vulnerabilities,
      score,
      timestamp: new Date()
    };
  }

  detectCredentials(code: string): CredentialReport {
    const credentials: Credential[] = [];

    for (const { type, pattern } of this.credentialPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        credentials.push({
          type: type as Credential['type'],
          file: 'input',
          line: this.getLineNumber(code, match.index),
          masked: this.maskCredential(match[1])
        });
      }
    }

    return {
      found: credentials.length > 0,
      credentials
    };
  }

  async auditPermissions(): Promise<PermissionReport> {
    const issues: PermissionIssue[] = [];

    // 检查文件权限
    issues.push(...await this.checkFilePermissions());

    // 检查目录权限
    issues.push(...await this.checkDirectoryPermissions());

    return { issues };
  }

  sanitizeLogs(logs: string): string {
    let sanitized = logs;

    // 脱敏邮箱
    sanitized = sanitized.replace(
      /[\w.-]+@[\w.-]+\.\w+/g,
      '[EMAIL_REDACTED]'
    );

    // 脱敏 IP 地址
    sanitized = sanitized.replace(
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
      '[IP_REDACTED]'
    );

    // 脱敏凭证
    for (const { pattern } of this.credentialPatterns) {
      sanitized = sanitized.replace(pattern, '[CREDENTIAL_REDACTED]');
    }

    return sanitized;
  }

  checkCommandSafety(command: string): CommandSafetyResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    // 检查危险命令
    for (const dangerous of this.dangerousCommands) {
      if (command.includes(dangerous)) {
        errors.push(`危险命令: ${dangerous}`);
      }
    }

    // 检查 sudo
    if (command.includes('sudo')) {
      warnings.push('命令使用了 sudo');
    }

    // 检查网络请求
    if (command.includes('curl') || command.includes('wget')) {
      warnings.push('命令会发起网络请求');
    }

    // 检查文件删除
    if (command.includes('rm ') || command.includes('rmdir')) {
      warnings.push('命令会删除文件');
    }

    return {
      safe: errors.length === 0,
      warnings,
      errors
    };
  }

  private detectSQLInjection(code: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    // 检测 SQL 注入模式
    // ... 实现
    return vulnerabilities;
  }

  private detectXSS(code: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    // 检测 XSS 模式
    // ... 实现
    return vulnerabilities;
  }

  private detectPathTraversal(code: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    // 检测路径遍历模式
    // ... 实现
    return vulnerabilities;
  }

  private detectCommandInjection(code: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    // 检测命令注入模式
    // ... 实现
    return vulnerabilities;
  }

  private calculateScore(vulnerabilities: Vulnerability[]): number {
    let score = 100;
    for (const vuln of vulnerabilities) {
      switch (vuln.severity) {
        case 'critical': score -= 25; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }
    return Math.max(0, score);
  }

  private getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split('\n').length;
  }

  private maskCredential(credential: string): string {
    if (credential.length <= 4) {
      return '****';
    }
    return credential.substring(0, 2) + '****' + credential.substring(credential.length - 2);
  }

  private async checkFilePermissions(): Promise<PermissionIssue[]> {
    // 检查文件权限
    return [];
  }

  private async checkDirectoryPermissions(): Promise<PermissionIssue[]> {
    // 检查目录权限
    return [];
  }
}
```

---

## 通用约定

### 错误处理

```typescript
interface ExtensionError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
  suggestion?: string;
}
```

### 日志规范

```typescript
interface Logger {
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, error?: Error, context?: unknown): void;
  debug(message: string, context?: unknown): void;
}
```

### 配置管理

```typescript
interface ConfigManager {
  get<T>(key: string, defaultValue?: T): T;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
  delete(key: string): void;
}
```
