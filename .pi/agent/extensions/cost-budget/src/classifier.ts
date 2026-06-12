import { BudgetClass } from "./constants";

// pi 内置工具 → 预算类别映射
// 核心理念：外部工具（不可控大小）给予严格配额，本地工具（可控）给予宽松配额
const TOOL_BUDGET_CLASS: Record<string, BudgetClass> = {
  // === EXTERNAL: 网络工具，输出不可控 ===
  web_search: BudgetClass.EXTERNAL,
  web_fetch: BudgetClass.EXTERNAL,
  fetch_content: BudgetClass.EXTERNAL,
  get_search_content: BudgetClass.EXTERNAL,
  code_search: BudgetClass.EXTERNAL,

  // === LOCAL: 文件系统和命令执行 ===
  read: BudgetClass.LOCAL,
  bash: BudgetClass.LOCAL,
  write: BudgetClass.LOCAL,
  edit: BudgetClass.LOCAL,
  lsp_diagnostics: BudgetClass.LOCAL,
  lsp_diagnostics_many: BudgetClass.LOCAL,
  lsp_hover: BudgetClass.LOCAL,
  lsp_definition: BudgetClass.LOCAL,
  lsp_references: BudgetClass.LOCAL,
  lsp_find_symbol: BudgetClass.LOCAL,
  lsp_document_symbols: BudgetClass.LOCAL,

  // === ARTIFACT: 产物/索引，不应裁剪 ===
  ctx_index: BudgetClass.ARTIFACT,
  ctx_fetch_and_index: BudgetClass.ARTIFACT,
  memory_save: BudgetClass.ARTIFACT,

  // === CONTROL: 控制/管理工具 ===
  agent_list: BudgetClass.CONTROL,
  task_decompose: BudgetClass.CONTROL,
  result_aggregate: BudgetClass.CONTROL,
  loop_status: BudgetClass.CONTROL,

  // === ERROR: 诊断工具 ===
  test_run: BudgetClass.ERROR,
  test_analyze: BudgetClass.ERROR,
  test_framework: BudgetClass.ERROR,
  ctx_doctor: BudgetClass.ERROR,
  ctx_stats: BudgetClass.ERROR,
};

// MCP 工具分类规则（基于 toolName 前缀匹配）
const MCP_EXTERNAL_PATTERNS = [
  "playwright_", // Playwright → 网页内容不可控
  "context7_", // Context7 搜索结果
];

/**
 * 根据工具名和是否 MCP 工具返回预算类别。
 * 复制 OpenSquilla 的 resolve_budget_class 逻辑。
 */
export function classifyTool(
  toolName: string,
  isMcp: boolean = false,
): BudgetClass {
  // 1. 直接映射命中
  if (TOOL_BUDGET_CLASS[toolName]) {
    return TOOL_BUDGET_CLASS[toolName];
  }

  // 2. MCP 工具 → 按模式匹配
  if (isMcp) {
    for (const pattern of MCP_EXTERNAL_PATTERNS) {
      if (toolName.startsWith(pattern)) return BudgetClass.EXTERNAL;
    }
    // 其他 MCP 工具默认为外部
    return BudgetClass.EXTERNAL;
  }

  // 3. Context-mode 内部工具 → 分类
  if (toolName.startsWith("ctx_")) {
    if (
      toolName === "ctx_index" ||
      toolName === "ctx_fetch_and_index" ||
      toolName === "ctx_purge"
    ) {
      return BudgetClass.ARTIFACT;
    }
    return BudgetClass.LOCAL;
  }

  // 4. subagent 工具
  if (toolName === "multi_agent" || toolName === "subagent") {
    return BudgetClass.CONTROL;
  }

  // 5. workflow 工具
  if (toolName.startsWith("workflow_")) {
    return BudgetClass.CONTROL;
  }

  // 6. memory 工具
  if (toolName.startsWith("memory_")) {
    return BudgetClass.ARTIFACT;
  }

  // 7. Custom/unknown
  return BudgetClass.UNKNOWN;
}
