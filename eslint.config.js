import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Require explicit accessibility modifiers on class members
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "explicit",
          overrides: {
            constructors: "no-public", // Constructors don't need 'public'
          },
        },
      ],

      // Require explicit return types on functions and methods
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],

      // Enforce consistent type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      // Disallow unused variables (but allow unused args starting with _)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // No floating promises
      "@typescript-eslint/no-floating-promises": "error",

      // No misused promises
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            arguments: false, // Allow async callbacks in event handlers
          },
        },
      ],

      // Consistent type assertions
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "as",
          objectLiteralTypeAssertions: "allow-as-parameter",
        },
      ],

      // No non-null assertions (prefer proper null checks)
      "@typescript-eslint/no-non-null-assertion": "warn",

      // No explicit any
      "@typescript-eslint/no-explicit-any": "warn",

      // Array type style
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
    },
  },
  {
    // Ignore built files
    ignores: ["dist/**", "node_modules/**", "*.js"],
  }
);

