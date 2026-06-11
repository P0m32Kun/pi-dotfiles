import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdversarialValidatorImpl, type Agent, type Finding } from './adversarial.js';

describe('AdversarialValidatorImpl', () => {
  let generator: Agent;
  let reviewer: Agent;

  beforeEach(() => {
    generator = {
      name: 'generator',
      model: 'gpt-4',
      systemPrompt: 'You are a code generator.',
      execute: vi.fn().mockResolvedValue('function add(a, b) { return a + b; }')
    };

    reviewer = {
      name: 'reviewer',
      model: 'claude-3',
      systemPrompt: 'You are a code reviewer.',
      execute: vi.fn().mockResolvedValue('No issues found. Code looks good.')
    };
  });

  describe('validate', () => {
    it('should approve code when no issues found', async () => {
      const validator = new AdversarialValidatorImpl(generator, reviewer, 3);
      const result = await validator.validate('Implement add function');

      expect(result.approved).toBe(true);
      expect(result.iterations).toBe(1);
      expect(generator.execute).toHaveBeenCalled();
      expect(reviewer.execute).toHaveBeenCalled();
    });

    it('should iterate when issues found', async () => {
      // First review finds issues, second approves
      reviewer.execute = vi.fn()
        .mockResolvedValueOnce('Issue: Missing input validation.')
        .mockResolvedValueOnce('No issues found.');

      generator.execute = vi.fn()
        .mockResolvedValueOnce('function add(a, b) { return a + b; }')
        .mockResolvedValueOnce('function add(a, b) { if (typeof a !== "number") throw new Error(); return a + b; }');

      const validator = new AdversarialValidatorImpl(generator, reviewer, 3);
      const result = await validator.validate('Implement add function');

      expect(result.approved).toBe(true);
      expect(result.iterations).toBe(2);
    });

    it('should stop at max iterations', async () => {
      reviewer.execute = vi.fn().mockResolvedValue('Issue: Always has issues.');
      generator.execute = vi.fn().mockResolvedValue('function add(a, b) { return a + b; }');

      const validator = new AdversarialValidatorImpl(generator, reviewer, 2);
      const result = await validator.validate('Implement add function');

      expect(result.approved).toBe(false);
      expect(result.iterations).toBe(2);
    });

    it('should track findings', async () => {
      reviewer.execute = vi.fn().mockResolvedValue('Issue: Missing error handling.\nIssue: No tests.');

      const validator = new AdversarialValidatorImpl(generator, reviewer, 1);
      const result = await validator.validate('Implement add function');

      expect(result.findings.length).toBeGreaterThan(0);
    });
  });

  describe('parseFindings', () => {
    it('should parse issues from review text', () => {
      const validator = new AdversarialValidatorImpl(generator, reviewer, 1);
      const findings = validator.parseFindings('Issue: Missing input validation.\nIssue: No error handling.');

      expect(findings.length).toBeGreaterThan(0);
    });

    it('should determine severity', () => {
      const validator = new AdversarialValidatorImpl(generator, reviewer, 1);
      const findings = validator.parseFindings('Critical: SQL injection vulnerability.\nMinor: Style issue.');

      expect(findings.some(f => f.severity === 'critical' || f.severity === 'high')).toBe(true);
    });
  });
});
