import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [".pi/extensions/**/tests/**/*.test.ts"],
    // TypeScript 扩展不需要编译，vitest 直接处理
  },
});
