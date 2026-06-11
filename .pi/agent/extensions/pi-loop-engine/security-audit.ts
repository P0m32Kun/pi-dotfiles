/**
 * Security audit utilities for pi-loop-engine.
 *
 * Provides command safety checking, credential detection,
 * path safety validation, and log sanitization.
 */

export interface CommandSafetyResult {
  safe: boolean;
  warnings: string[];
  errors: string[];
}

export interface Credential {
  type: 'api_key' | 'password' | 'token' | 'secret';
  file: string;
  line: number;
  masked: string;
}

export interface CredentialReport {
  found: boolean;
  credentials: Credential[];
}

export interface PathSafetyResult {
  safe: boolean;
  warnings: string[];
}

export interface SecurityAuditor {
  checkCommandSafety(command: string): CommandSafetyResult;
  detectCredentials(code: string): CredentialReport;
  checkPathSafety(path: string): PathSafetyResult;
  sanitizeLogs(logs: string): string;
}

// Credential patterns
const CREDENTIAL_PATTERNS = [
  { type: 'api_key' as const, pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([^'"]+)['"]/gi },
  { type: 'password' as const, pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]+)['"]/gi },
  { type: 'token' as const, pattern: /(?:token|access[_-]?token)\s*[:=]\s*['"]([^'"]+)['"]/gi },
  { type: 'secret' as const, pattern: /(?:secret|secret[_-]?key)\s*[:=]\s*['"]([^'"]+)['"]/gi }
];

// Dangerous command patterns
const DANGEROUS_COMMANDS = [
  { pattern: /rm\s+-[rf]+\s+[\/~]/, name: 'rm -rf /' },
  { pattern: />\s*\/dev\/sd[a-z]/, name: 'dd to disk' },
  { pattern: /mkfs\./, name: 'mkfs' },
  { pattern: /chmod\s+777/, name: 'chmod 777' },
  { pattern: /curl.*\|\s*(ba)?sh/, name: 'curl | bash' },
  { pattern: /wget.*\|\s*(ba)?sh/, name: 'wget | bash' },
  { pattern: /:\(\)\{.*\|.*:\}/, name: 'fork bomb' }
];

export class SecurityAuditorImpl implements SecurityAuditor {
  /**
   * Check if a command is safe to execute.
   */
  checkCommandSafety(command: string): CommandSafetyResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for dangerous commands
    for (const { pattern, name } of DANGEROUS_COMMANDS) {
      if (pattern.test(command)) {
        errors.push(`Dangerous command detected: ${name}`);
      }
    }

    // Check for sudo
    if (command.includes('sudo')) {
      warnings.push('Command uses sudo - verify permissions');
    }

    // Check for network requests
    if (command.includes('curl') || command.includes('wget') || command.includes('http')) {
      warnings.push('Command makes network requests');
    }

    // Check for file deletion
    if (/\brm\s/.test(command) || command.includes('rmdir')) {
      warnings.push('Command deletes files');
    }

    return {
      safe: errors.length === 0,
      warnings,
      errors
    };
  }

  /**
   * Detect credentials in code.
   */
  detectCredentials(code: string): CredentialReport {
    const credentials: Credential[] = [];

    for (const { type, pattern } of CREDENTIAL_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(code)) !== null) {
        credentials.push({
          type,
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

  /**
   * Check if a path is safe.
   */
  checkPathSafety(filePath: string): PathSafetyResult {
    const warnings: string[] = [];

    // Check for path traversal
    if (filePath.includes('..')) {
      return {
        safe: false,
        warnings: ['Path contains traversal characters (..)']
      };
    }

    // Check for sensitive directories
    const sensitiveDirs = ['/etc', '/var', '/usr', '/root', '/proc', '/sys'];
    for (const dir of sensitiveDirs) {
      if (filePath.startsWith(dir)) {
        warnings.push(`Path accesses sensitive directory: ${dir}`);
      }
    }

    // Check for hidden files
    if (filePath.includes('/.')) {
      warnings.push('Path accesses hidden files');
    }

    return {
      safe: true,
      warnings
    };
  }

  /**
   * Sanitize logs by redacting sensitive information.
   */
  sanitizeLogs(logs: string): string {
    let sanitized = logs;

    // Redact emails
    sanitized = sanitized.replace(
      /[\w.-]+@[\w.-]+\.\w+/g,
      '[EMAIL_REDACTED]'
    );

    // Redact IPv4 addresses
    sanitized = sanitized.replace(
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
      '[IP_REDACTED]'
    );

    // Redact credentials
    for (const { pattern } of CREDENTIAL_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      sanitized = sanitized.replace(regex, '[CREDENTIAL_REDACTED]');
    }

    return sanitized;
  }

  /**
   * Get line number for a position in text.
   */
  private getLineNumber(text: string, index: number): number {
    return text.substring(0, index).split('\n').length;
  }

  /**
   * Mask a credential value.
   */
  private maskCredential(value: string): string {
    if (value.length <= 4) return '****';
    return value.substring(0, 2) + '****' + value.substring(value.length - 2);
  }
}

/**
 * Create a SecurityAuditor instance.
 */
export function createSecurityAuditor(): SecurityAuditorImpl {
  return new SecurityAuditorImpl();
}
