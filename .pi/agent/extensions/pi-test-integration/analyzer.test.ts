import { describe, it, expect } from 'vitest';
import { FailureAnalyzerImpl } from './analyzer.js';

describe('FailureAnalyzerImpl', () => {
  const analyzer = new FailureAnalyzerImpl();

  describe('analyze', () => {
    it('should analyze assertion errors', async () => {
      const failure = {
        testName: 'should equal',
        error: 'expected 1 to equal 2',
        actual: 1,
        expected: 2
      };

      const result = await analyzer.analyze(failure);

      expect(result.rootCause).toBeDefined();
      expect(result.suggestion).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should analyze type errors', async () => {
      const failure = {
        testName: 'should not throw',
        error: 'TypeError: Cannot read property of undefined',
        stack: 'TypeError: Cannot read property "foo" of undefined\n    at Object.<anonymous> (test.js:5:10)'
      };

      const result = await analyzer.analyze(failure);

      expect(result.rootCause).toContain('undefined');
      expect(result.suggestion).toBeDefined();
    });

    it('should analyze reference errors', async () => {
      const failure = {
        testName: 'should have variable',
        error: 'ReferenceError: myVar is not defined'
      };

      const result = await analyzer.analyze(failure);

      expect(result.rootCause).toContain('not defined');
      expect(result.suggestion).toBeDefined();
    });

    it('should handle unknown errors', async () => {
      const failure = {
        testName: 'unknown test',
        error: 'Something went wrong'
      };

      const result = await analyzer.analyze(failure);

      expect(result.rootCause).toBeDefined();
      expect(result.suggestion).toBeDefined();
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should provide related files', async () => {
      const failure = {
        testName: 'test',
        error: 'Error in file',
        file: '/path/to/test.ts'
      };

      const result = await analyzer.analyze(failure);

      expect(Array.isArray(result.relatedFiles)).toBe(true);
    });
  });
});
