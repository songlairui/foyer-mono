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
];

export default defineConfig({
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
