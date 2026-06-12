import { describe, it, expect, beforeEach } from "vitest";
import { classifyTool } from "../src/classifier";
import { BudgetClass } from "../src/constants";

describe("classifyTool", () => {
  // ─── EXTERNAL ───────────────────────────────────────────────
  it("classifies web_search as EXTERNAL", () => {
    expect(classifyTool("web_search")).toBe(BudgetClass.EXTERNAL);
  });

  it("classifies web_fetch as EXTERNAL", () => {
    expect(classifyTool("web_fetch")).toBe(BudgetClass.EXTERNAL);
  });

  it("classifies fetch_content as EXTERNAL", () => {
    expect(classifyTool("fetch_content")).toBe(BudgetClass.EXTERNAL);
  });

  it("classifies get_search_content as EXTERNAL", () => {
    expect(classifyTool("get_search_content")).toBe(BudgetClass.EXTERNAL);
  });

  it("classifies code_search as EXTERNAL", () => {
    expect(classifyTool("code_search")).toBe(BudgetClass.EXTERNAL);
  });

  // ─── LOCAL ──────────────────────────────────────────────────
  it("classifies read as LOCAL", () => {
    expect(classifyTool("read")).toBe(BudgetClass.LOCAL);
  });

  it("classifies bash as LOCAL", () => {
    expect(classifyTool("bash")).toBe(BudgetClass.LOCAL);
  });

  it("classifies write as LOCAL", () => {
    expect(classifyTool("write")).toBe(BudgetClass.LOCAL);
  });

  it("classifies edit as LOCAL", () => {
    expect(classifyTool("edit")).toBe(BudgetClass.LOCAL);
  });

  it("classifies lsp_diagnostics as LOCAL", () => {
    expect(classifyTool("lsp_diagnostics")).toBe(BudgetClass.LOCAL);
  });

  it("classifies lsp_hover as LOCAL", () => {
    expect(classifyTool("lsp_hover")).toBe(BudgetClass.LOCAL);
  });

  it("classifies lsp_definition as LOCAL", () => {
    expect(classifyTool("lsp_definition")).toBe(BudgetClass.LOCAL);
  });

  it("classifies lsp_references as LOCAL", () => {
    expect(classifyTool("lsp_references")).toBe(BudgetClass.LOCAL);
  });

  it("classifies lsp_find_symbol as LOCAL", () => {
    expect(classifyTool("lsp_find_symbol")).toBe(BudgetClass.LOCAL);
  });

  it("classifies lsp_document_symbols as LOCAL", () => {
    expect(classifyTool("lsp_document_symbols")).toBe(BudgetClass.LOCAL);
  });

  // ─── ARTIFACT ───────────────────────────────────────────────
  it("classifies ctx_index as ARTIFACT", () => {
    expect(classifyTool("ctx_index")).toBe(BudgetClass.ARTIFACT);
  });

  it("classifies ctx_fetch_and_index as ARTIFACT", () => {
    expect(classifyTool("ctx_fetch_and_index")).toBe(BudgetClass.ARTIFACT);
  });

  it("classifies memory_save as ARTIFACT", () => {
    expect(classifyTool("memory_save")).toBe(BudgetClass.ARTIFACT);
  });

  it("classifies ctx_purge as ARTIFACT", () => {
    expect(classifyTool("ctx_purge")).toBe(BudgetClass.ARTIFACT);
  });

  // ─── CONTROL ────────────────────────────────────────────────
  it("classifies agent_list as CONTROL", () => {
    expect(classifyTool("agent_list")).toBe(BudgetClass.CONTROL);
  });

  it("classifies task_decompose as CONTROL", () => {
    expect(classifyTool("task_decompose")).toBe(BudgetClass.CONTROL);
  });

  it("classifies result_aggregate as CONTROL", () => {
    expect(classifyTool("result_aggregate")).toBe(BudgetClass.CONTROL);
  });

  it("classifies loop_status as CONTROL", () => {
    expect(classifyTool("loop_status")).toBe(BudgetClass.CONTROL);
  });

  it("classifies multi_agent as CONTROL", () => {
    expect(classifyTool("multi_agent")).toBe(BudgetClass.CONTROL);
  });

  it("classifies subagent as CONTROL", () => {
    expect(classifyTool("subagent")).toBe(BudgetClass.CONTROL);
  });

  it("classifies workflow tools as CONTROL", () => {
    expect(classifyTool("workflow_execute")).toBe(BudgetClass.CONTROL);
    expect(classifyTool("workflow_status")).toBe(BudgetClass.CONTROL);
    expect(classifyTool("workflow_load")).toBe(BudgetClass.CONTROL);
  });

  // ─── ERROR ──────────────────────────────────────────────────
  it("classifies test_run as ERROR", () => {
    expect(classifyTool("test_run")).toBe(BudgetClass.ERROR);
  });

  it("classifies test_analyze as ERROR", () => {
    expect(classifyTool("test_analyze")).toBe(BudgetClass.ERROR);
  });

  it("classifies test_framework as ERROR", () => {
    expect(classifyTool("test_framework")).toBe(BudgetClass.ERROR);
  });

  it("classifies ctx_doctor as ERROR", () => {
    expect(classifyTool("ctx_doctor")).toBe(BudgetClass.ERROR);
  });

  it("classifies ctx_stats as ERROR", () => {
    expect(classifyTool("ctx_stats")).toBe(BudgetClass.ERROR);
  });

  // ─── MCP 工具 ───────────────────────────────────────────────
  it("classifies MCP playwright tools as EXTERNAL", () => {
    expect(classifyTool("playwright_navigate", true)).toBe(BudgetClass.EXTERNAL);
    expect(classifyTool("playwright_screenshot", true)).toBe(BudgetClass.EXTERNAL);
  });

  it("classifies MCP context7 tools as EXTERNAL", () => {
    expect(classifyTool("context7_resolve-library-id", true)).toBe(BudgetClass.EXTERNAL);
  });

  it("classifies unknown MCP tools as EXTERNAL", () => {
    expect(classifyTool("some_mcp_tool", true)).toBe(BudgetClass.EXTERNAL);
  });

  // ─── UNKNOWN ────────────────────────────────────────────────
  it("classifies unknown tools as UNKNOWN", () => {
    expect(classifyTool("custom_tool")).toBe(BudgetClass.UNKNOWN);
    expect(classifyTool("my_custom_extension")).toBe(BudgetClass.UNKNOWN);
  });

  // ─── memory 工具 ────────────────────────────────────────────
  it("classifies memory_search as ARTIFACT", () => {
    expect(classifyTool("memory_search")).toBe(BudgetClass.ARTIFACT);
  });

  it("classifies memory_health as ARTIFACT", () => {
    expect(classifyTool("memory_health")).toBe(BudgetClass.ARTIFACT);
  });

  // ─── 覆盖性检查 ─────────────────────────────────────────────
  it("all classified tools have a non-UNKNOWN class", () => {
    const knownTools = [
      "web_search", "web_fetch", "fetch_content", "get_search_content", "code_search",
      "read", "bash", "write", "edit", "lsp_diagnostics", "lsp_diagnostics_many",
      "lsp_hover", "lsp_definition", "lsp_references", "lsp_find_symbol", "lsp_document_symbols",
      "ctx_index", "ctx_fetch_and_index", "memory_save",
      "agent_list", "task_decompose", "result_aggregate", "loop_status",
      "test_run", "test_analyze", "test_framework", "ctx_doctor", "ctx_stats",
      "multi_agent", "subagent",
      "workflow_execute", "workflow_status", "workflow_load",
      "memory_search", "memory_health",
    ];

    for (const tool of knownTools) {
      const result = classifyTool(tool);
      expect(result).not.toBe(BudgetClass.UNKNOWN);
    }
  });
});
