import { defineConfig } from "vite-plus";

const ignoredGeneratedPaths = [
  ".git/**",
  ".sc/**",
  ".flue-dist/**",
  ".flue/**",
  "adapters/**",
  "dist/**",
  "node_modules/**",
  "packages/*/dist/**",
  "packages/*/node_modules/**",
  "packages/*/tui/**",
];

export default defineConfig({
  run: {
    tasks: {
      "link:cli": {
        command: "pnpm run build && pnpm link -g",
        cwd: "packages/cli",
      },
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ignoredGeneratedPaths,
  },
  lint: {
    ignorePatterns: ignoredGeneratedPaths,
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
