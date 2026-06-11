/**
 * Performance utilities for pi extensions.
 *
 * Provides caching, memoization, and performance monitoring.
 */

// ── Cache ──────────────────────────────────────────────────

export class Cache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 60000) {
    this.defaultTTL = defaultTTL;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + (ttl ?? this.defaultTTL)
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// ── Memoize ────────────────────────────────────────────────

export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string,
  ttl?: number
): T {
  const cache = new Cache<Awaited<ReturnType<T>>>(ttl);

  return ((...args: Parameters<T>) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);

    // Handle promises
    if (result instanceof Promise) {
      return result.then(value => {
        cache.set(key, value);
        return value;
      });
    }

    cache.set(key, result);
    return result;
  }) as T;
}

// ── Performance Monitor ────────────────────────────────────

export class PerformanceMonitor {
  private metrics = new Map<string, { count: number; totalMs: number; maxMs: number }>();

  start(label: string): () => void {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.record(label, duration);
    };
  }

  record(label: string, durationMs: number): void {
    const existing = this.metrics.get(label) ?? { count: 0, totalMs: 0, maxMs: 0 };

    this.metrics.set(label, {
      count: existing.count + 1,
      totalMs: existing.totalMs + durationMs,
      maxMs: Math.max(existing.maxMs, durationMs)
    });
  }

  getMetrics(label: string): { count: number; avgMs: number; maxMs: number } | undefined {
    const metric = this.metrics.get(label);
    if (!metric) return undefined;

    return {
      count: metric.count,
      avgMs: metric.totalMs / metric.count,
      maxMs: metric.maxMs
    };
  }

  getAllMetrics(): Record<string, { count: number; avgMs: number; maxMs: number }> {
    const result: Record<string, { count: number; avgMs: number; maxMs: number }> = {};

    for (const [label, metric] of this.metrics) {
      result[label] = {
        count: metric.count,
        avgMs: metric.totalMs / metric.count,
        maxMs: metric.maxMs
      };
    }

    return result;
  }

  reset(): void {
    this.metrics.clear();
  }
}

// ── Debounce ───────────────────────────────────────────────

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = undefined;
    }, delay);
  };
}

// ── Throttle ───────────────────────────────────────────────

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// ── Batch Processor ────────────────────────────────────────

export class BatchProcessor<T, R> {
  private batch: T[] = [];
  private batchSize: number;
  private flushInterval: number;
  private processFn: (items: T[]) => Promise<R[]>;
  private timeoutId: ReturnType<typeof setTimeout> | undefined;

  constructor(
    processFn: (items: T[]) => Promise<R[]>,
    options: { batchSize?: number; flushInterval?: number } = {}
  ) {
    this.processFn = processFn;
    this.batchSize = options.batchSize ?? 10;
    this.flushInterval = options.flushInterval ?? 1000;
  }

  add(item: T): void {
    this.batch.push(item);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  async flush(): Promise<R[]> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    if (this.batch.length === 0) {
      return [];
    }

    const items = [...this.batch];
    this.batch = [];

    return this.processFn(items);
  }

  size(): number {
    return this.batch.length;
  }
}

// ── Singleton ──────────────────────────────────────────────

export function singleton<T>(factory: () => T): () => T {
  let instance: T | undefined;

  return () => {
    if (instance === undefined) {
      instance = factory();
    }
    return instance;
  };
}

// ── Lazy ───────────────────────────────────────────────────

export function lazy<T>(factory: () => T): { get: () => T } {
  let instance: T | undefined;
  let initialized = false;

  return {
    get: () => {
      if (!initialized) {
        instance = factory();
        initialized = true;
      }
      return instance!;
    }
  };
}
