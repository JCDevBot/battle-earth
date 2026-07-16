import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

const recommendedAsWarnings = Object.fromEntries(
  Object.entries(js.configs.recommended.rules).map(([name, value]) => [
    name,
    value === "error" ? "warn" : value,
  ]),
);

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "docs/devlog/**",
      "public/data/**",
    ],
  },
  {
    files: ["src/**/*.{js,jsx}", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...recommendedAsWarnings,
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["*.config.js", "eslint.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: recommendedAsWarnings,
  },
];
