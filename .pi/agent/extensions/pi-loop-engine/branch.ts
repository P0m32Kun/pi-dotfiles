/**
 * Conditional branch support for pi-loop-engine.
 *
 * Provides conditional execution of step paths based on
 * string expressions or function predicates.
 */

export interface Step {
  id: string;
  execute: () => Promise<StepResult>;
}

export interface StepResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ConditionalBranch {
  condition: string | (() => boolean);
  truePath: Step[];
  falsePath: Step[];
  context?: Record<string, unknown>;
}

export interface BranchResult {
  executed: 'true' | 'false';
  result?: StepResult;
  stepsExecuted: string[];
}

/**
 * Evaluate a condition expression.
 *
 * Supports:
 * - String 'true'/'false'
 * - Function predicates
 * - Simple comparison expressions with context variables
 */
export function evaluateCondition(
  condition: string | (() => boolean),
  context?: Record<string, unknown>
): boolean {
  if (typeof condition === 'function') {
    return condition();
  }

  // Handle simple boolean strings
  if (condition === 'true') return true;
  if (condition === 'false') return false;

  // Handle comparison expressions
  if (context) {
    try {
      // Simple expression evaluator for common patterns
      // Supports: variable > number, variable < number, variable == value
      const comparisonMatch = condition.match(/^(\w+)\s*(>|<|>=|<=|==|!=)\s*(.+)$/);
      if (comparisonMatch) {
        const [, varName, operator, valueStr] = comparisonMatch;
        const varValue = context[varName];
        let compareValue: unknown = valueStr;

        // Parse numeric values
        if (/^\d+$/.test(valueStr)) {
          compareValue = parseInt(valueStr, 10);
        } else if (/^\d+\.\d+$/.test(valueStr)) {
          compareValue = parseFloat(valueStr);
        } else if (valueStr === 'true') {
          compareValue = true;
        } else if (valueStr === 'false') {
          compareValue = false;
        } else if (valueStr === 'null') {
          compareValue = null;
        } else if (valueStr === 'undefined') {
          compareValue = undefined;
        }

        switch (operator) {
          case '>':
            return (varValue as number) > (compareValue as number);
          case '<':
            return (varValue as number) < (compareValue as number);
          case '>=':
            return (varValue as number) >= (compareValue as number);
          case '<=':
            return (varValue as number) <= (compareValue as number);
          case '==':
            return varValue == compareValue;
          case '!=':
            return varValue != compareValue;
        }
      }

      // Handle simple variable truthiness
      if (/^\w+$/.test(condition)) {
        return !!context[condition];
      }
    } catch {
      // Fall through to default
    }
  }

  // Default: treat non-empty string as truthy
  return condition.trim().length > 0;
}

/**
 * Execute a conditional branch.
 *
 * Evaluates the condition and executes either the true or false path.
 * Returns the result of the executed path.
 */
export async function executeBranch(branch: ConditionalBranch): Promise<BranchResult> {
  const conditionResult = evaluateCondition(branch.condition, branch.context);
  const path = conditionResult ? branch.truePath : branch.falsePath;
  const executed: 'true' | 'false' = conditionResult ? 'true' : 'false';
  const stepsExecuted: string[] = [];
  let lastResult: StepResult | undefined;

  for (const step of path) {
    stepsExecuted.push(step.id);
    lastResult = await step.execute();
  }

  return {
    executed,
    result: lastResult,
    stepsExecuted,
  };
}

/**
 * Create a conditional branch from configuration.
 */
export function createBranch(config: {
  condition: string | (() => boolean);
  trueSteps: Array<{ id: string; execute: () => Promise<StepResult> }>;
  falseSteps: Array<{ id: string; execute: () => Promise<StepResult> }>;
  context?: Record<string, unknown>;
}): ConditionalBranch {
  return {
    condition: config.condition,
    truePath: config.trueSteps,
    falsePath: config.falseSteps,
    context: config.context,
  };
}
