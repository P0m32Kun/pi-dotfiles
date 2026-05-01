---
name: audit
description: |
  安全/代码审计工作流：威胁建模 → 深度审计 → 修复 → 复验。
  适用于安全审查、代码审计、合规检查。
  Triggers on: 安全, 审计, audit, vulnerability, auth, 加密, 输入验证, /audit.
---

## Step 1: oracle
output: threat-model.md

加载 security-and-hardening skill，执行威胁建模：
- 攻击面分析
- OWASP Top 10 风险检查
- 敏感数据流追踪
- 认证/授权模式审查
- 输出威胁模型 + 风险列表

## Step 2: reviewer
output: audit-findings.md
reads: threat-model.md

加载 security-and-hardening 和 code-review-and-quality skill，执行深度审计：
- 输入验证检查
- 注入漏洞检测
- 密钥/凭据处理审查
- 并发安全检查
- 文件系统遍历检查
- 错误处理审查
- 输出 P0-P3 分级的发现列表

## Step 3: delegate
output: remediated.md
reads: audit-findings.md

修复安全问题：
- 优先修复 P0/P1
- 添加输入验证
- 添加对抗性测试
- 确保代码/日志无密钥泄露

## Step 4: reviewer
output: final-security-report.md
reads: remediated.md

加载 golang-testing skill（Go 代码）或 frontend-ui-engineering skill（前端代码），执行复验：
- 确认所有发现已修复
- 运行安全测试
- 检查无新增漏洞
- 输出最终安全报告
