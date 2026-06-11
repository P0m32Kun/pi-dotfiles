/**
 * pi-workflow-engine - Workflow orchestration extension for pi-coding-agent.
 *
 * Provides workflow definition, execution, state machine,
 * parallel execution, and error handling.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { WorkflowEngine } from "./core.js";
import { ParallelExecutor } from "./parallel.js";
import { StateMachine } from "./state-machine.js";
import { ErrorHandler } from "./error-handler.js";
import type {
  WorkflowDefinition,
  ToolExecutor,
  StepDefinition
} from "./types.js";

export default function workflowEngineExtension(pi: ExtensionAPI) {
  // Create tool executor that uses pi's bash tool
  const toolExecutor: ToolExecutor = {
    async execute(tool: string, args: Record<string, unknown>) {
      // For now, we'll use a simple mock
      // In production, this would call pi's registered tools
      return { success: true, tool, args };
    }
  };

  // Create engine instances
  const engine = new WorkflowEngine(toolExecutor);
  const parallelExecutor = new ParallelExecutor(toolExecutor);
  const errorHandler = new ErrorHandler({
    maxRetries: 3,
    strategies: {
      retry: { maxAttempts: 3, strategy: 'immediate' },
      skip: { enabled: true },
      rollback: { enabled: true },
      fallback: { enabled: true }
    }
  });

  // Store loaded workflows
  const workflows = new Map<string, WorkflowDefinition>();

  // ── Register tool: workflow_load ──────────────────────────

  pi.registerTool({
    name: "workflow_load",
    label: "Load Workflow",
    description: "加载工作流定义。支持 JSON 格式的工作流定义。",
    parameters: Type.Object({
      name: Type.String({ description: "工作流名称" }),
      definition: Type.Optional(Type.Any({ description: "工作流定义 (JSON)" })),
      path: Type.Optional(Type.String({ description: "工作流定义文件路径" }))
    }),
    async execute(_toolCallId, params) {
      try {
        let definition: WorkflowDefinition;

        if (params.definition) {
          definition = params.definition as WorkflowDefinition;
        } else if (params.path) {
          // In production, read from file
          throw new Error("File loading not implemented yet");
        } else {
          throw new Error("Must provide either definition or path");
        }

        // Ensure name is set
        definition.name = params.name;

        // Load into engine
        await engine.load(definition);
        workflows.set(params.name, definition);

        return {
          content: [{
            type: "text",
            text: `✅ 工作流 "${params.name}" 已加载\n- 步骤数: ${definition.steps?.length ?? 0}\n- 并行组: ${definition.parallel?.length ?? 0}\n- 状态: ${definition.states?.length ?? 0}`
          }],
          details: { name: params.name, steps: definition.steps?.length ?? 0 }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ 加载失败: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  });

  // ── Register tool: workflow_execute ──────────────────────

  pi.registerTool({
    name: "workflow_execute",
    label: "Execute Workflow",
    description: "执行已加载的工作流。",
    parameters: Type.Object({
      name: Type.String({ description: "工作流名称" }),
      context: Type.Optional(Type.Any({ description: "执行上下文变量" }))
    }),
    async execute(_toolCallId, params, signal, onUpdate) {
      try {
        const workflow = workflows.get(params.name);
        if (!workflow) {
          throw new Error(`工作流 "${params.name}" 未加载`);
        }

        // Update context if provided
        if (params.context) {
          engine.setContext(params.context);
        }

        // Execute workflow
        onUpdate?.({ content: [{ type: "text", text: "⏳ 正在执行工作流..." }] });
        const result = await engine.execute();

        const statusIcon = result.status === 'completed' ? '✅' : 
                          result.status === 'failed' ? '❌' : '⏸️';

        return {
          content: [{
            type: "text",
            text: `${statusIcon} 工作流执行完成\n- 状态: ${result.status}\n- 步骤: ${result.steps.length}\n- 耗时: ${result.duration}ms${result.error ? `\n- 错误: ${result.error}` : ''}`
          }],
          details: result
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ 执行失败: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  });

  // ── Register tool: workflow_status ───────────────────────

  pi.registerTool({
    name: "workflow_status",
    label: "Workflow Status",
    description: "查看工作流状态。",
    parameters: Type.Object({
      name: Type.Optional(Type.String({ description: "工作流名称" }))
    }),
    async execute(_toolCallId, params) {
      const status = engine.getStatus();
      const currentState = engine.getCurrentState();

      let text = "## 工作流状态\n\n";
      
      if (status.loaded) {
        text += `- 已加载: ${status.name}\n`;
        if (currentState) {
          text += `- 当前状态: ${currentState}\n`;
        }
      } else {
        text += "- 未加载工作流\n";
      }

      if (workflows.size > 0) {
        text += "\n### 已加载的工作流\n";
        for (const [name, def] of workflows) {
          text += `- ${name} (${def.steps?.length ?? 0} 步骤)\n`;
        }
      }

      return {
        content: [{ type: "text", text }],
        details: { status, currentState, workflows: Array.from(workflows.keys()) }
      };
    }
  });

  // ── Register tool: workflow_parallel ─────────────────────

  pi.registerTool({
    name: "workflow_parallel",
    label: "Execute Parallel Steps",
    description: "并行执行多个步骤。",
    parameters: Type.Object({
      steps: Type.Array(Type.Object({
        id: Type.String(),
        tool: Type.String(),
        args: Type.Any()
      }), { description: "要并行执行的步骤" }),
      maxConcurrency: Type.Optional(Type.Number({ description: "最大并发数" }))
    }),
    async execute(_toolCallId, params, signal, onUpdate) {
      try {
        onUpdate?.({ content: [{ type: "text", text: `⏳ 并行执行 ${params.steps.length} 个步骤...` }] });

        const result = await parallelExecutor.execute(
          params.steps as StepDefinition[],
          { maxConcurrency: params.maxConcurrency }
        );

        const successCount = result.results.filter(r => r.status === 'success').length;

        return {
          content: [{
            type: "text",
            text: `✅ 并行执行完成\n- 成功: ${successCount}/${result.results.length}\n- 耗时: ${result.duration}ms`
          }],
          details: result
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ 并行执行失败: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  });

  // ── Register tool: workflow_state ────────────────────────

  pi.registerTool({
    name: "workflow_state",
    label: "State Machine",
    description: "查看或触发状态机事件。",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("status"),
        Type.Literal("trigger"),
        Type.Literal("history")
      ]),
      event: Type.Optional(Type.String({ description: "要触发的事件" }))
    }),
    async execute(_toolCallId, params) {
      try {
        switch (params.action) {
          case "status":
            return {
              content: [{
                type: "text",
                text: `当前状态: ${engine.getCurrentState() ?? '无状态机'}`
              }]
            };

          case "trigger":
            if (!params.event) {
              throw new Error("必须提供事件名称");
            }
            await engine.triggerEvent(params.event);
            return {
              content: [{
                type: "text",
                text: `✅ 已触发事件 "${params.event}"，当前状态: ${engine.getCurrentState()}`
              }]
            };

          case "history":
            const history = engine.getStateHistory();
            let text = "## 状态历史\n\n";
            for (const entry of history) {
              text += `- ${entry.state} (${new Date(entry.timestamp).toISOString()})`;
              if (entry.event) text += ` ← ${entry.event}`;
              text += "\n";
            }
            return {
              content: [{ type: "text", text }],
              details: { history }
            };

          default:
            throw new Error(`未知操作: ${params.action}`);
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  });

  // ── Register command: /workflow ──────────────────────────

  pi.registerCommand("workflow", {
    description: "工作流管理 (load/execute/status/list)",
    getArgumentCompletions: (prefix: string) => {
      const commands = ["load", "execute", "status", "list"];
      return commands
        .filter(c => c.startsWith(prefix))
        .map(c => ({ value: c, label: c }));
    },
    handler: async (args, ctx) => {
      const [command, ...rest] = args.split(/\s+/);

      switch (command) {
        case "list":
          if (workflows.size === 0) {
            ctx.ui.notify("没有已加载的工作流", "info");
          } else {
            let text = "已加载的工作流:\n";
            for (const [name, def] of workflows) {
              text += `- ${name} (${def.steps?.length ?? 0} 步骤)\n`;
            }
            ctx.ui.notify(text, "info");
          }
          break;

        case "status":
          const status = engine.getStatus();
          ctx.ui.notify(
            status.loaded
              ? `工作流 "${status.name}" 已加载，状态: ${engine.getCurrentState() ?? '无'}`
              : "未加载工作流",
            "info"
          );
          break;

        default:
          ctx.ui.notify("用法: /workflow [load|execute|status|list]", "warning");
      }
    }
  });

  // ── Register session event ──────────────────────────────

  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setStatus("workflow-engine", "🔄 workflow engine");
  });
}
