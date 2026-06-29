import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["node_modules/**", ".old/**", "**/poke.db", ".cache/**", "**/*.d.ts"],
  },

  // Base + strict, type-aware rules for the whole TS codebase.
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node, Bun: "readonly" },
    },
    rules: {
      // TypeScript already resolves identifiers; no-undef double-flags Bun/globals.
      "no-undef": "off",
      // Best-effort fetches/parses in the build script swallow failures on purpose.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // The agent/store/team JSON crosses an LLM boundary and is intentionally `any`.
  // Relax the rules that fight that design instead of scattering disables inline.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",

      // Purely stylistic — turned off so the linter stays high-signal:
      "@typescript-eslint/restrict-template-expressions": "off", // `${number}` in strings is fine
      "@typescript-eslint/no-non-null-assertion": "off", // `!` is used deliberately
      "@typescript-eslint/consistent-type-definitions": "off", // type vs interface, no preference
      "@typescript-eslint/array-type": "off", // T[] vs Array<T>, no preference
      "@typescript-eslint/no-dynamic-delete": "off", // `delete map[key]` is intentional
      "@typescript-eslint/require-await": "off", // async route/handler uniformity

      // `||` is intentional and often MORE correct here than `??`
      // (e.g. `Number(PORT) || 3000` must fall back on 0; `?? ` would not).
      "@typescript-eslint/prefer-nullish-coalescing": "off",

      // Allow `onClick={() => setX()}` and `forEach(x => doThing(x))`.
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],

      // Async event handlers / route handlers are safe; keep the dangerous checks only.
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],

      // Visible but non-blocking signal:
      "@typescript-eslint/no-deprecated": "warn",
      "@typescript-eslint/no-unnecessary-condition": "warn",
    },
  },

  // React frontend (browser globals + hooks rules).
  {
    files: ["packages/web/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Resetting derived state on a dependency change is acceptable here.
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  // Plain JS config files: no type-aware linting.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  prettier,
);
