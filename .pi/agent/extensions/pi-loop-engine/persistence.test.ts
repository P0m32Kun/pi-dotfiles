import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FilePersistence, MemoryPersistence, type LoopState } from './persistence.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('persistence', () => {
  const testState: LoopState = {
    attempts: { test: 3, build: 1 },
    failures: [],
    totalRetries: 4,
    totalSuccesses: 2,
    lastUpdated: Date.now(),
    loopCounters: { whileLoop1: 5 },
    branchHistory: []
  };

  describe('MemoryPersistence', () => {
    it('should save and load state', async () => {
      const persistence = new MemoryPersistence();
      await persistence.save(testState);
      const loaded = await persistence.load();
      expect(loaded).toEqual(testState);
    });

    it('should return null when no state exists', async () => {
      const persistence = new MemoryPersistence();
      const loaded = await persistence.load();
      expect(loaded).toBeNull();
    });

    it('should clear state', async () => {
      const persistence = new MemoryPersistence();
      await persistence.save(testState);
      await persistence.clear();
      const loaded = await persistence.load();
      expect(loaded).toBeNull();
    });

    it('should overwrite previous state', async () => {
      const persistence = new MemoryPersistence();
      await persistence.save(testState);
      
      const newState: LoopState = {
        ...testState,
        totalRetries: 10
      };
      await persistence.save(newState);
      
      const loaded = await persistence.load();
      expect(loaded?.totalRetries).toBe(10);
    });
  });

  describe('FilePersistence', () => {
    const tmpDir = os.tmpdir();
    const testFile = path.join(tmpDir, `test-loop-state-${Date.now()}.json`);

    afterEach(async () => {
      try {
        await fs.promises.unlink(testFile);
      } catch {
        // Ignore if file doesn't exist
      }
    });

    it('should save and load state from file', async () => {
      const persistence = new FilePersistence(testFile);
      await persistence.save(testState);
      
      const loaded = await persistence.load();
      expect(loaded).toEqual(testState);
    });

    it('should return null when file does not exist', async () => {
      const persistence = new FilePersistence('/nonexistent/path/state.json');
      const loaded = await persistence.load();
      expect(loaded).toBeNull();
    });

    it('should clear state by deleting file', async () => {
      const persistence = new FilePersistence(testFile);
      await persistence.save(testState);
      await persistence.clear();
      
      const exists = await fs.promises.access(testFile).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should create directory if not exists', async () => {
      const nestedDir = path.join(tmpDir, `nested-${Date.now()}`);
      const nestedFile = path.join(nestedDir, 'state.json');
      
      const persistence = new FilePersistence(nestedFile);
      await persistence.save(testState);
      
      const loaded = await persistence.load();
      expect(loaded).toEqual(testState);
      
      // Cleanup
      await fs.promises.rm(nestedDir, { recursive: true, force: true });
    });

    it('should handle invalid JSON gracefully', async () => {
      await fs.promises.writeFile(testFile, 'invalid json', 'utf-8');
      
      const persistence = new FilePersistence(testFile);
      const loaded = await persistence.load();
      expect(loaded).toBeNull();
    });
  });
});
