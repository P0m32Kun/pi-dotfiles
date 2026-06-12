import { describe, it, expect, beforeEach } from "vitest";
import {
  CostTracker,
  normalizeCostSource,
  rollupCostSource,
  estimateCost,
} from "../src/cost-tracker";
import type { CostSource } from "../src/cost-tracker";

describe("normalizeCostSource", () => {
  it("returns provider_billed when billed > 0 and estimated <= billed", () => {
    expect(
      normalizeCostSource({ billedCostUsd: 0.01, estimatedCostUsd: 0.005, hasTokens: true })
    ).toBe("provider_billed");
  });

  it("returns mixed when billed > 0 and estimated > billed", () => {
    expect(
      normalizeCostSource({ billedCostUsd: 0.01, estimatedCostUsd: 0.02, hasTokens: true })
    ).toBe("mixed");
  });

  it("returns our_estimate when billed = 0 and estimated > 0", () => {
    expect(
      normalizeCostSource({ billedCostUsd: 0, estimatedCostUsd: 0.01, hasTokens: true })
    ).toBe("our_estimate");
  });

  it("returns unavailable when no cost but has tokens", () => {
    expect(
      normalizeCostSource({ billedCostUsd: 0, estimatedCostUsd: 0, hasTokens: true })
    ).toBe("unavailable");
  });

  it("returns none when no cost and no tokens", () => {
    expect(
      normalizeCostSource({ billedCostUsd: 0, estimatedCostUsd: 0, hasTokens: false })
    ).toBe("none");
  });
});

describe("rollupCostSource", () => {
  it("returns mixed when multiple sources present", () => {
    expect(rollupCostSource(0.01, 0.02, 1)).toBe("mixed");
  });

  it("returns provider_billed when only billed is present", () => {
    expect(rollupCostSource(0.01, 0, 0)).toBe("provider_billed");
  });

  it("returns our_estimate when only estimate is present", () => {
    expect(rollupCostSource(0, 0.01, 0)).toBe("our_estimate");
  });

  it("returns unavailable when only missing entries present", () => {
    expect(rollupCostSource(0, 0, 1)).toBe("unavailable");
  });

  it("returns none when nothing present", () => {
    expect(rollupCostSource(0, 0, 0)).toBe("none");
  });
});

describe("estimateCost", () => {
  it("calculates DeepSeek-chat cost correctly", () => {
    const cost = estimateCost(1_000_000, 1_000_000, "deepseek-chat");
    expect(cost).toBeCloseTo(0.14 + 0.28, 4);
  });

  it("calculates DeepSeek-reasoner cost correctly", () => {
    const cost = estimateCost(1_000_000, 1_000_000, "deepseek-reasoner");
    expect(cost).toBeCloseTo(0.55 + 2.19, 4);
  });

  it("returns 0 for unknown models", () => {
    expect(estimateCost(1_000_000, 1_000_000, "gpt-4")).toBe(0);
  });

  it("handles partial model ID matching", () => {
    const cost = estimateCost(500_000, 500_000, "deepseek-chat-2024");
    expect(cost).toBeGreaterThan(0);
  });

  it("returns 0 for zero tokens", () => {
    expect(estimateCost(0, 0, "deepseek-chat")).toBe(0);
  });
});

describe("CostTracker", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it("records a turn with provider billed cost", () => {
    const turn = tracker.recordTurn({
      turnIndex: 1,
      modelId: "deepseek-chat",
      inputTokens: 1000,
      outputTokens: 500,
      billedCostUsd: 0.001,
    });

    expect(turn.source).toBe("provider_billed");
    expect(turn.costUsd).toBe(0.001);
    expect(turn.inputTokens).toBe(1000);
    expect(turn.outputTokens).toBe(500);
  });

  it("records a turn with estimated cost", () => {
    const turn = tracker.recordTurn({
      turnIndex: 1,
      modelId: "deepseek-chat",
      inputTokens: 1000,
      outputTokens: 500,
    });

    expect(turn.source).toBe("our_estimate");
    expect(turn.costUsd).toBeGreaterThan(0);
  });

  it("records a turn with no cost (unavailable)", () => {
    const turn = tracker.recordTurn({
      turnIndex: 1,
      modelId: "unknown-model",
      inputTokens: 1000,
      outputTokens: 500,
    });

    expect(turn.source).toBe("unavailable");
    expect(turn.costUsd).toBe(0);
  });

  it("records a turn with zero tokens (none)", () => {
    const turn = tracker.recordTurn({
      turnIndex: 1,
      modelId: "unknown-model",
      inputTokens: 0,
      outputTokens: 0,
    });

    expect(turn.source).toBe("none");
  });

  it("summarizes multiple turns correctly", () => {
    tracker.recordTurn({
      turnIndex: 1,
      modelId: "deepseek-chat",
      inputTokens: 1000,
      outputTokens: 500,
      billedCostUsd: 0.001,
    });
    tracker.recordTurn({
      turnIndex: 2,
      modelId: "deepseek-chat",
      inputTokens: 2000,
      outputTokens: 1000,
      billedCostUsd: 0.002,
    });

    const summary = tracker.summarize();
    expect(summary.turns).toBe(2);
    expect(summary.totalInputTokens).toBe(3000);
    expect(summary.totalOutputTokens).toBe(1500);
    expect(summary.totalCostUsd).toBeCloseTo(0.003, 4);
    expect(summary.byModel["deepseek-chat"].turns).toBe(2);
  });

  it("groups by model correctly", () => {
    tracker.recordTurn({
      turnIndex: 1,
      modelId: "deepseek-chat",
      inputTokens: 1000,
      outputTokens: 500,
      billedCostUsd: 0.001,
    });
    tracker.recordTurn({
      turnIndex: 2,
      modelId: "deepseek-reasoner",
      inputTokens: 500,
      outputTokens: 200,
      billedCostUsd: 0.005,
    });

    const summary = tracker.summarize();
    expect(Object.keys(summary.byModel)).toHaveLength(2);
    expect(summary.byModel["deepseek-chat"].turns).toBe(1);
    expect(summary.byModel["deepseek-reasoner"].turns).toBe(1);
  });

  it("returns empty summary when no turns recorded", () => {
    const summary = tracker.summarize();
    expect(summary.turns).toBe(0);
    expect(summary.totalCostUsd).toBe(0);
    expect(summary.costSource).toBe("none");
  });

  it("getLastTurn returns the most recent turn", () => {
    tracker.recordTurn({ turnIndex: 1, modelId: "a", inputTokens: 1, outputTokens: 1 });
    tracker.recordTurn({ turnIndex: 2, modelId: "b", inputTokens: 2, outputTokens: 2 });

    expect(tracker.getLastTurn()?.modelId).toBe("b");
  });

  it("reset clears all turns", () => {
    tracker.recordTurn({ turnIndex: 1, modelId: "a", inputTokens: 1, outputTokens: 1 });
    tracker.reset();
    expect(tracker.summarize().turns).toBe(0);
  });

  it("handles mixed cost sources in rollup", () => {
    tracker.recordTurn({
      turnIndex: 1,
      modelId: "deepseek-chat",
      inputTokens: 1000,
      outputTokens: 500,
      billedCostUsd: 0.001,
    });
    tracker.recordTurn({
      turnIndex: 2,
      modelId: "unknown-model",
      inputTokens: 1000,
      outputTokens: 500,
    });

    const summary = tracker.summarize();
    expect(summary.costSource).toBe("mixed");
  });

  it("prefers billed cost over estimated cost", () => {
    const turn = tracker.recordTurn({
      turnIndex: 1,
      modelId: "deepseek-chat",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      billedCostUsd: 0.005,
    });

    // estimated would be ~0.42, but billed is 0.005
    // billed < estimated → mixed
    expect(turn.source).toBe("mixed");
  });
});
