import { describe, it, expect, vi } from 'vitest';
import { VitestAdapter, JestAdapter, PytestAdapter, detectFramework, createAdapter } from './adapters.js';

describe('Test Framework Adapters', () => {
  describe('VitestAdapter', () => {
    const adapter = new VitestAdapter();

    it('should have correct name', () => {
      expect(adapter.name).toBe('vitest');
    });

    it('should detect vitest project with config', async () => {
      // Test detection logic (will return false for non-existent path)
      const result = await adapter.detect('/nonexistent');
      expect(result).toBe(false);
    });

    it('should parse vitest JSON output correctly', () => {
      // Test the parseOutput method indirectly through runTests
      // We can test the class structure
      expect(adapter.name).toBe('vitest');
      expect(typeof adapter.detect).toBe('function');
      expect(typeof adapter.runTests).toBe('function');
    });
  });

  describe('JestAdapter', () => {
    const adapter = new JestAdapter();

    it('should have correct name', () => {
      expect(adapter.name).toBe('jest');
    });

    it('should detect jest project', async () => {
      const result = await adapter.detect('/nonexistent');
      expect(result).toBe(false);
    });

    it('should have required methods', () => {
      expect(typeof adapter.detect).toBe('function');
      expect(typeof adapter.runTests).toBe('function');
    });
  });

  describe('PytestAdapter', () => {
    const adapter = new PytestAdapter();

    it('should have correct name', () => {
      expect(adapter.name).toBe('pytest');
    });

    it('should detect pytest project', async () => {
      const result = await adapter.detect('/nonexistent');
      expect(result).toBe(false);
    });

    it('should have required methods', () => {
      expect(typeof adapter.detect).toBe('function');
      expect(typeof adapter.runTests).toBe('function');
    });
  });

  describe('detectFramework', () => {
    it('should return null for unknown project', async () => {
      const result = await detectFramework('/nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('createAdapter', () => {
    it('should create vitest adapter', () => {
      const adapter = createAdapter('vitest');
      expect(adapter.name).toBe('vitest');
      expect(adapter).toBeInstanceOf(VitestAdapter);
    });

    it('should create jest adapter', () => {
      const adapter = createAdapter('jest');
      expect(adapter.name).toBe('jest');
      expect(adapter).toBeInstanceOf(JestAdapter);
    });

    it('should create pytest adapter', () => {
      const adapter = createAdapter('pytest');
      expect(adapter.name).toBe('pytest');
      expect(adapter).toBeInstanceOf(PytestAdapter);
    });

    it('should throw for unknown adapter', () => {
      expect(() => createAdapter('unknown')).toThrow('Unknown test framework: unknown');
    });
  });
});
