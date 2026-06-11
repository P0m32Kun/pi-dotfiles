/**
 * Adversarial validation for pi-multi-agent.
 *
 * Uses separate agents for code generation and review
 * to prevent self-preference bias.
 */

export interface Agent {
  name: string;
  model: string;
  systemPrompt: string;
  execute(task: string): Promise<string>;
}

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  suggestion: string;
}

export interface ValidationResult {
  approved: boolean;
  findings: Finding[];
  iterations: number;
  duration: number;
  code?: string;
}

export interface AdversarialValidator {
  generator: Agent;
  reviewer: Agent;
  maxIterations: number;
  validate(task: string): Promise<ValidationResult>;
  parseFindings(reviewText: string): Finding[];
}

export class AdversarialValidatorImpl implements AdversarialValidator {
  generator: Agent;
  reviewer: Agent;
  maxIterations: number;

  constructor(generator: Agent, reviewer: Agent, maxIterations: number = 3) {
    this.generator = generator;
    this.reviewer = reviewer;
    this.maxIterations = maxIterations;
  }

  /**
   * Execute adversarial validation.
   */
  async validate(task: string): Promise<ValidationResult> {
    const startTime = Date.now();
    let iterations = 0;
    let currentCode = '';
    let allFindings: Finding[] = [];

    while (iterations < this.maxIterations) {
      iterations++;

      // 1. Generate code
      const generatePrompt = iterations === 1
        ? task
        : `${task}\n\nPrevious code:\n${currentCode}\n\nPlease fix these issues:\n${allFindings.map(f => `- ${f.description}`).join('\n')}`;

      currentCode = await this.generator.execute(generatePrompt);

      // 2. Review code
      const reviewPrompt = `Review this code for issues:\n\n${currentCode}`;
      const reviewResult = await this.reviewer.execute(reviewPrompt);

      // 3. Parse findings
      const findings = this.parseFindings(reviewResult);
      allFindings = findings;

      // 4. If no critical/high/medium issues, approve
      const hasBlockingIssues = findings.some(
        f => f.severity === 'critical' || f.severity === 'high' || f.severity === 'medium'
      );

      if (!hasBlockingIssues) {
        return {
          approved: true,
          findings: allFindings,
          iterations,
          duration: Date.now() - startTime,
          code: currentCode
        };
      }
    }

    // Reached max iterations
    return {
      approved: false,
      findings: allFindings,
      iterations,
      duration: Date.now() - startTime,
      code: currentCode
    };
  }

  /**
   * Parse findings from review text.
   */
  parseFindings(reviewText: string): Finding[] {
    const findings: Finding[] = [];
    const lines = reviewText.split('\n');

    let id = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Look for issue patterns
      const issueMatch = trimmed.match(/^(?:Issue|Problem|Bug|Warning|Error|Critical|Major|Minor)[:\s]+(.+)/i);
      if (issueMatch) {
        id++;
        findings.push({
          id: `finding-${id}`,
          severity: this.determineSeverity(trimmed),
          category: 'code-quality',
          description: issueMatch[1].trim(),
          suggestion: ''
        });
      }

      // Look for severity-prefixed issues
      const severityMatch = trimmed.match(/^(Critical|High|Medium|Low|Major|Minor)[:\s]+(.+)/i);
      if (severityMatch && !issueMatch) {
        id++;
        findings.push({
          id: `finding-${id}`,
          severity: this.mapSeverity(severityMatch[1]),
          category: 'code-quality',
          description: severityMatch[2].trim(),
          suggestion: ''
        });
      }
    }

    return findings;
  }

  /**
   * Determine severity from text.
   */
  private determineSeverity(text: string): Finding['severity'] {
    const lower = text.toLowerCase();

    if (lower.includes('critical') || lower.includes('security') || lower.includes('vulnerability') || lower.includes('injection')) {
      return 'critical';
    }
    if (lower.includes('high') || lower.includes('error') || lower.includes('bug')) {
      return 'high';
    }
    if (lower.includes('medium') || lower.includes('warning')) {
      return 'medium';
    }
    // Default issue to medium (not low) to ensure they are reviewed
    return 'medium';
  }

  /**
   * Map severity string to type.
   */
  private mapSeverity(severity: string): Finding['severity'] {
    const lower = severity.toLowerCase();
    if (lower === 'critical' || lower === 'major') return 'critical';
    if (lower === 'high') return 'high';
    if (lower === 'medium') return 'medium';
    return 'low';
  }
}

/**
 * Create an AdversarialValidator instance.
 */
export function createAdversarialValidator(
  generator: Agent,
  reviewer: Agent,
  maxIterations?: number
): AdversarialValidatorImpl {
  return new AdversarialValidatorImpl(generator, reviewer, maxIterations);
}
