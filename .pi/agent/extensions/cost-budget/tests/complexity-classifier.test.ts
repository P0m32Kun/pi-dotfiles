import { describe, it, expect } from "vitest";
import { classifyComplexity, tierToModelConfig } from "../src/complexity-classifier";

describe("classifyComplexity", () => {
  // ─── c0: 超简单输入 ────────────────────────────────────────
  it("classifies very short input as c0", () => {
    const result = classifyComplexity("hello");
    expect(result.tier).toBe("c0");
    expect(result.score).toBeLessThanOrEqual(0.5);
  });

  it("classifies empty input as c0", () => {
    const result = classifyComplexity("");
    expect(result.tier).toBe("c0");
  });

  it("classifies greeting as c0", () => {
    const result = classifyComplexity("hi");
    expect(result.tier).toBe("c0");
    expect(result.reasons).toContain("greeting");
  });

  it("classifies thanks as c0", () => {
    const result = classifyComplexity("thanks!");
    expect(result.tier).toBe("c0");
  });

  // ─── c1: 一般任务 ──────────────────────────────────────────
  it("classifies medium-length input as c1", () => {
    const result = classifyComplexity("What is the difference between React and Vue?");
    expect(result.tier).toBe("c1");
  });

  it("classifies short coding question as c1", () => {
    const result = classifyComplexity("How do I use useEffect in React?");
    expect(result.tier).toBe("c1");
  });

  // ─── c2: 中度复杂 ──────────────────────────────────────────
  it("classifies implementation request as c2", () => {
    const result = classifyComplexity(
      "Please implement a new authentication system with JWT tokens and refresh token rotation for our API"
    );
    expect(result.tier).toBe("c2");
    expect(result.reasons).toContain("implementation_request");
  });

  it("classifies debugging request with context as c2", () => {
    const result = classifyComplexity(
      "I'm getting a weird error when I try to deploy my application to production. The error stack trace shows a null pointer exception in the authentication module. Here's the error message: Error: Cannot read property 'token' of undefined at AuthService.validateToken"
    );
    expect(result.tier).toBe("c2");
  });

  it("classifies code block with substantial text as c2", () => {
    const result = classifyComplexity(
      "Can you review this code and suggest improvements?\n```typescript\nfunction process(data: any) {\n  return data.map(x => x.value).filter(v => v > 0).reduce((a, b) => a + b, 0);\n}\n```\nI think there might be performance issues with large datasets and I want to optimize it for production use."
    );
    expect(result.tier).toBe("c2");
  });

  it("classifies optimization request as c2", () => {
    const result = classifyComplexity(
      "Please optimize the performance of our database queries. We're seeing slow response times and need to improve the overall system performance."
    );
    expect(result.tier).toBe("c2");
  });

  // ─── c3: 高复杂度 ──────────────────────────────────────────
  it("classifies long refactor request as c3", () => {
    const result = classifyComplexity(
      "We need to refactor the entire authentication module to support multiple providers. This involves migrating from the old session-based auth to a new OAuth2/OIDC based system. The migration should be done incrementally, maintaining backward compatibility. We also need to update all the middleware, frontend integration, and admin dashboard. The new system should support Google, GitHub, and Microsoft providers, with proper error handling and fallback mechanisms. Please design the architecture and provide a detailed implementation plan."
    );
    expect(result.tier).toBe("c3");
  });

  it("classifies architecture design request as c3", () => {
    const result = classifyComplexity(
      "请设计一个高可用的微服务架构，包括服务发现、负载均衡、熔断器、分布式追踪等组件，需要支持水平扩展和故障自动恢复"
    );
    expect(result.tier).toBe("c3");
  });

  it("classifies very long multiline input as c3", () => {
    const lines = Array(60).fill("This is a line of code that does something important.");
    const result = classifyComplexity(lines.join("\n"));
    expect(result.tier).toBe("c3");
  });

  // ─── 长上下文修正 ───────────────────────────────────────────
  it("upgrades to c2 for long context (>4000 chars)", () => {
    const result = classifyComplexity("x".repeat(5000));
    expect(result.tier).toBe("c2");
    expect(result.reasons).toContain("long_context");
  });

  // ─── 多文件修正 ─────────────────────────────────────────────
  it("upgrades to c2 for multi-file mentions", () => {
    const result = classifyComplexity(
      "Please update `auth.ts`, `login.tsx`, `register.tsx`, `middleware.ts`, and `config.yaml` to use the new API."
    );
    expect(result.tier).toBe("c2");
    expect(result.reasons.some((r) => r.includes("multi_file"))).toBe(true);
  });

  // ─── score 边界 ─────────────────────────────────────────────
  it("returns default reason for unclassified input", () => {
    const result = classifyComplexity("hi"); // c0
    expect(result.reasons).toBeDefined();
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("caps score at 3.0", () => {
    // 即使触发多个规则，score 不超过 3.0
    const result = classifyComplexity(
      "refactor architecture ".repeat(100) + "x".repeat(6000)
    );
    expect(result.score).toBeLessThanOrEqual(3.0);
  });
});

describe("tierToModelConfig", () => {
  it("maps c0 to cheapest model", () => {
    const config = tierToModelConfig("c0");
    expect(config.recommendedModel).toBe("deepseek-chat");
  });

  it("maps c1 to default model", () => {
    const config = tierToModelConfig("c1");
    expect(config.recommendedModel).toBe("deepseek-chat");
  });

  it("maps c2 to stronger model", () => {
    const config = tierToModelConfig("c2");
    expect(config.recommendedModel).toBe("deepseek-v4-pro");
  });

  it("maps c3 to strongest model", () => {
    const config = tierToModelConfig("c3");
    expect(config.recommendedModel).toBe("deepseek-v4-pro");
  });

  it("all tiers have a provider", () => {
    for (const tier of ["c0", "c1", "c2", "c3"] as const) {
      const config = tierToModelConfig(tier);
      expect(config.recommendedProvider).toBeTruthy();
      expect(config.recommendedModel).toBeTruthy();
    }
  });
});
