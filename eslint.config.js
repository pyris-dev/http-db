import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import localPlugin from "./eslint-plugins/local-plugin.js";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "bundle/**",
      "database/**",
      "node_modules/**",
      "bundle.ts"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    plugins: {
      local: localPlugin
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        projectService: true
      },
      globals: {
        ...globals.es2024,
        ...globals.node,
        ...globals.browser,
        ...globals.bun
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "local/no-single-statement-if-block": "error"
    }
  }
);
