/**
 * Security audit utilities for pi extensions.
 *
 * Provides input validation, sanitization, and security checks.
 */

// ── Input Validation ───────────────────────────────────────

export interface ValidationRule {
  name: string;
  validate: (value: unknown) => boolean;
  message: string;
}

export class InputValidator {
  private rules: ValidationRule[] = [];

  addRule(rule: ValidationRule): this {
    this.rules.push(rule);
    return this;
  }

  validate(value: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const rule of this.rules) {
      if (!rule.validate(value)) {
        errors.push(rule.message);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

// Common validation rules
export const commonRules = {
  notEmpty: (field: string): ValidationRule => ({
    name: `${field}_notEmpty`,
    validate: (value) => typeof value === 'string' && value.trim().length > 0,
    message: `${field} cannot be empty`
  }),

  maxLength: (field: string, max: number): ValidationRule => ({
    name: `${field}_maxLength`,
    validate: (value) => typeof value === 'string' && value.length <= max,
    message: `${field} must be ${max} characters or less`
  }),

  pattern: (field: string, pattern: RegExp): ValidationRule => ({
    name: `${field}_pattern`,
    validate: (value) => typeof value === 'string' && pattern.test(value),
    message: `${field} has invalid format`
  }),

  noScript: (field: string): ValidationRule => ({
    name: `${field}_noScript`,
    validate: (value) => {
      if (typeof value !== 'string') return true;
      const lower = value.toLowerCase();
      return !lower.includes('<script') && !lower.includes('javascript:');
    },
    message: `${field} contains potentially dangerous content`
  }),

  noPathTraversal: (field: string): ValidationRule => ({
    name: `${field}_noPathTraversal`,
    validate: (value) => {
      if (typeof value !== 'string') return true;
      return !value.includes('..') && !value.includes('~');
    },
    message: `${field} contains path traversal characters`
  })
};

// ── Sanitization ───────────────────────────────────────────

export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

export function sanitizePath(input: string): string {
  // Remove path traversal attempts
  return input
    .replace(/\.\./g, '')
    .replace(/~/g, '')
    .replace(/\/+/g, '/') // Normalize multiple slashes
    .trim();
}

export function sanitizeCommand(input: string): string {
  // Remove potentially dangerous command characters
  return input
    .replace(/[;&|`$]/g, '')
    .replace(/\n/g, ' ')
    .trim();
}

// ── Security Checks ────────────────────────────────────────

export interface SecurityCheckResult {
  safe: boolean;
  warnings: string[];
  errors: string[];
}

export function checkCommandSafety(command: string): SecurityCheckResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for dangerous commands
  const dangerousCommands = ['rm -rf', 'mkfs', 'dd', 'format', '> /dev/'];
  for (const dangerous of dangerousCommands) {
    if (command.includes(dangerous)) {
      errors.push(`Dangerous command detected: ${dangerous}`);
    }
  }

  // Check for sudo
  if (command.includes('sudo')) {
    warnings.push('Command uses sudo');
  }

  // Check for network operations
  if (command.includes('curl') || command.includes('wget')) {
    warnings.push('Command makes network requests');
  }

  // Check for file operations
  if (command.includes('rm ') || command.includes('rmdir')) {
    warnings.push('Command deletes files');
  }

  return {
    safe: errors.length === 0,
    warnings,
    errors
  };
}

export function checkPathSafety(path: string): SecurityCheckResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for path traversal
  if (path.includes('..')) {
    errors.push('Path contains traversal characters');
  }

  // Check for sensitive directories
  const sensitiveDirs = ['/etc', '/var', '/usr', '/root', '/home'];
  for (const dir of sensitiveDirs) {
    if (path.startsWith(dir)) {
      warnings.push(`Path accesses sensitive directory: ${dir}`);
    }
  }

  // Check for hidden files
  if (path.includes('/.')) {
    warnings.push('Path accesses hidden files');
  }

  return {
    safe: errors.length === 0,
    warnings,
    errors
  };
}

// ── Rate Limiter ───────────────────────────────────────────

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this key
    let requests = this.requests.get(key) ?? [];

    // Remove old requests outside the window
    requests = requests.filter(time => time > windowStart);

    // Check if limit exceeded
    if (requests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    requests.push(now);
    this.requests.set(key, requests);

    return true;
  }

  reset(key?: string): void {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }
}

// ── Audit Logger ───────────────────────────────────────────

export interface AuditEntry {
  timestamp: number;
  action: string;
  user?: string;
  resource: string;
  details?: Record<string, unknown>;
  result: 'success' | 'failure' | 'warning';
}

export class AuditLogger {
  private entries: AuditEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  log(entry: Omit<AuditEntry, 'timestamp'>): void {
    this.entries.push({
      ...entry,
      timestamp: Date.now()
    });

    // Trim old entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  getEntries(filter?: { action?: string; result?: string }): AuditEntry[] {
    let entries = [...this.entries];

    if (filter?.action) {
      entries = entries.filter(e => e.action === filter.action);
    }

    if (filter?.result) {
      entries = entries.filter(e => e.result === filter.result);
    }

    return entries;
  }

  clear(): void {
    this.entries = [];
  }
}
