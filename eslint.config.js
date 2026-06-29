import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["node_modules/**", ".old/**", "**/poke.db", ".cache/**", "**/*.d.ts"],
  },

  // Full strictness: every strict + stylistic type-aware rule, nothing pre-disabled.
  // Disable individual rules below only when they prove genuinely painful.
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node, ...globals.browser, Bun: "readonly" },
    },
    rules: {
      // Not a relaxation: TypeScript already catches undefined identifiers, and
      // no-undef (which is type-blind) only adds false positives for globals like
      // Response/ReadableStream/Bun. typescript-eslint recommends turning it off.
      "no-undef": "off",
      // Interpolating numbers into strings is fine (this is the rule's own default;
      // the strict preset disables it). Keeps `${count}` logging readable.
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },

  // React frontend: browser globals + hooks rules at recommended strength.
  {
    files: ["packages/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },

  // Plain JS config files: no type-aware linting (no tsconfig project for them).
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  prettier,
);
