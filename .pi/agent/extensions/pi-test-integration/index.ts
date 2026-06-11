/**
 * pi-test-integration - Test framework integration extension for pi-coding-agent.
 *
 * Provides test framework detection, test running, and failure analysis.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { detectFramework, createAdapter } from "./adapters.js";
import { FailureAnalyzerImpl } from "./analyzer.js";
import type { TestFrameworkAdapter, TestFailure } from "./types.js";

export default function testIntegrationExtension(pi: ExtensionAPI) {
  const analyzer = new FailureAnalyzerImpl();
  const frameworkCache = new Map<string, TestFrameworkAdapter | null>();

  async function getFramework(projectPath: string): Promise<TestFrameworkAdapter | null> {
    if (frameworkCache.has(projectPath)) {
      return frameworkCache.get(projectPath)!;
    }
    const framework = await detectFramework(projectPath);
    frameworkCache.set(projectPath, framework);
    return framework;
  }

  // Register tool: test_run
  pi.registerTool({
    name: "test_run",
    label: "Run Tests",
    description: "Run project tests. Auto-detects Vitest/Jest/Pytest.",
    parameters: Type.Object({
      pattern: Type.Optional(Type.String({ description: "Test file pattern" })),
      framework: Type.Optional(Type.String({ description: "Test framework (vitest/jest/pytest)" })),
      bail: Type.Optional(Type.Boolean({ description: "Stop on first failure" })),
      timeout: Type.Optional(Type.Number({ description: "Timeout in ms" }))
    }),
    async execute(_toolCallId, params, signal, onUpdate) {
      try {
        const cwd = process.cwd();
        onUpdate?.({ content: [{ type: "text", text: "Detecting test framework..." }] });

        let adapter: TestFrameworkAdapter;
        if (params.framework) {
          adapter = createAdapter(params.framework);
        } else {
          const detected = await getFramework(cwd);
          if (!detected) {
            return {
              content: [{ type: "text", text: "No test framework detected. Install Vitest, Jest, or Pytest." }],
              isError: true
            };
          }
          adapter = detected;
        }

        onUpdate?.({ content: [{ type: "text", text: `Running tests with ${adapter.name}...` }] });

        const result = await adapter.runTests({
          pattern: params.pattern,
          bail: params.bail,
          timeout: params.timeout,
          cwd
        });

        const icon = result.status === 'passed' ? 'OK' : 'FAIL';
        let text = `${icon} Tests completed (${adapter.name})\n`;
        text += `Status: ${result.status}\n`;
        text += `Total: ${result.total}\n`;
        text += `Passed: ${result.passed}\n`;
        text += `Failed: ${result.failed}\n`;
        text += `Duration: ${result.duration}ms\n`;

        if (result.error) {
          text += `\nError: ${result.error}\n`;
        }

        return {
          content: [{ type: "text", text }],
          details: result
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Test failed: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    }
  });

  // Register tool: test_analyze
  pi.registerTool({
    name: "test_analyze",
    label: "Analyze Test Failure",
    description: "Analyze test failure and provide fix suggestions.",
    parameters: Type.Object({
      testName: Type.String({ description: "Test name" }),
      error: Type.String({ description: "Error message" }),
      stack: Type.Optional(Type.String({ description: "Error stack" })),
      file: Type.Optional(Type.String({ description: "Test file path" }))
    }),
    async execute(_toolCallId, params) {
      try {
        const failure: TestFailure = {
          testName: params.testName,
          error: params.error,
          stack: params.stack,
          file: params.file
        };

        const analysis = await analyzer.analyze(failure);

        let text = `## Test Failure Analysis\n\n`;
        text += `### Test\n${params.testName}\n\n`;
        text += `### Root Cause\n${analysis.rootCause}\n\n`;
        text += `### Suggestion\n${analysis.suggestion}\n\n`;
        text += `### Confidence\n${(analysis.confidence * 100).toFixed(0)}%\n`;

        if (analysis.relatedFiles.length > 0) {
          text += `\n### Related Files\n`;
          for (const file of analysis.relatedFiles) {
            text += `- ${file}\n`;
          }
        }

        return {
          content: [{ type: "text", text }],
          details: analysis
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    }
  });

  // Register tool: test_framework
  pi.registerTool({
    name: "test_framework",
    label: "Detect Test Framework",
    description: "Detect test framework used by the project.",
    parameters: Type.Object({
      path: Type.Optional(Type.String({ description: "Project path" }))
    }),
    async execute(_toolCallId, params) {
      try {
        const projectPath = params.path || process.cwd();
        const framework = await detectFramework(projectPath);

        let text = `## Test Framework Detection\n\n`;
        if (framework) {
          text += `Detected: **${framework.name}**\n`;
        } else {
          text += `No test framework detected.\n`;
          text += `\nSupported: Vitest, Jest, Pytest\n`;
        }

        return {
          content: [{ type: "text", text }],
          details: { framework: framework?.name ?? null }
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Detection failed: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    }
  });

  // Register command
  pi.registerCommand("test", {
    description: "Test management (run/analyze/framework)",
    handler: async (args, ctx) => {
      const [command] = args.split(/\s+/);
      switch (command) {
        case "framework":
          const framework = await detectFramework(process.cwd());
          ctx.ui.notify(
            framework ? `Detected: ${framework.name}` : "No test framework detected",
            framework ? "info" : "warning"
          );
          break;
        default:
          ctx.ui.notify("Usage: /test [run|analyze|framework]", "warning");
      }
    }
  });

  // Session event
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setStatus("test-integration", "test-integration");
  });
}
