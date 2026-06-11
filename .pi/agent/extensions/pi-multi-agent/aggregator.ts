/**
 * Result aggregator for pi-multi-agent.
 *
 * Aggregates results from multiple subtasks into a final result.
 */

import type { SubTaskResult, FinalResult, ResultAggregator } from './types.js';

export class ResultAggregatorImpl implements ResultAggregator {
  /**
   * Aggregate multiple subtask results into a final result.
   */
  async aggregate(results: SubTaskResult[]): Promise<FinalResult> {
    if (results.length === 0) {
      return {
        status: 'success',
        output: null,
        summary: 'No tasks to aggregate (0/0 succeeded)',
        details: []
      };
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failure').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    // Determine overall status
    let status: 'success' | 'partial' | 'failure';
    if (failureCount === 0 && skippedCount === 0) {
      status = 'success';
    } else if (successCount > 0) {
      status = 'partial';
    } else {
      status = 'failure';
    }

    // Combine outputs
    const outputs = results
      .filter(r => r.status === 'success' && r.output)
      .map(r => String(r.output));

    const output = outputs.length > 0 ? outputs.join('\n\n') : null;

    // Collect errors
    const errors = results
      .filter(r => r.status === 'failure' && r.error)
      .map(r => `${r.taskId}: ${r.error}`);

    // Build summary
    const summary = this.buildSummary(
      successCount,
      failureCount,
      skippedCount,
      results.length,
      errors
    );

    return {
      status,
      output,
      summary,
      details: results
    };
  }

  /**
   * Build a human-readable summary.
   */
  private buildSummary(
    success: number,
    failure: number,
    skipped: number,
    total: number,
    errors: string[]
  ): string {
    const parts: string[] = [];

    parts.push(`${success}/${total} tasks succeeded`);

    if (failure > 0) {
      parts.push(`${failure} failed`);
    }

    if (skipped > 0) {
      parts.push(`${skipped} skipped`);
    }

    if (errors.length > 0) {
      parts.push('\nErrors:');
      for (const error of errors.slice(0, 3)) {
        parts.push(`- ${error}`);
      }
      if (errors.length > 3) {
        parts.push(`... and ${errors.length - 3} more`);
      }
    }

    return parts.join(', ');
  }
}

/**
 * Create a result aggregator.
 */
export function createResultAggregator(): ResultAggregatorImpl {
  return new ResultAggregatorImpl();
}
