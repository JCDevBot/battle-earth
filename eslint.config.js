import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

const warningSeverity = (value) => {
  if (value === "error" || value === 2) {
    return "warn";
  }

  if (Array.isArray(value) && (value[0] === "error" || value[0] === 2)) {
    return ["warn", ...value.slice(1)];
  }

  return value;
};

const asWarnings = (rules) =>
  Object.fromEntries(
    Object.entries(rules).map(([name, value]) => [name, warningSeverity(value)]),
  );

const recommendedAsWarnings = asWarnings(js.configs.recommended.rules);
const reactHooksAsWarnings = asWarnings(reactHooks.configs.recommended.rules);

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
      ...reactHooksAsWarnings,
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
