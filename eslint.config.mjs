import globals from "globals";
import path from "node:path";
import {fileURLToPath} from "node:url";
import js from "@eslint/js";
import {FlatCompat} from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [...compat.extends("eslint:recommended"), {
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.commonjs,
        },

        ecmaVersion: "latest",
        sourceType: "module",
    },

    rules: {
        "no-undef": "off",
        "func-call-spacing": "off",

        "max-len": ["error", {
            code: 120,
        }],

        "new-parens": "error",
        "no-caller": "error",
        "no-bitwise": "off",
        "no-console": "off",
        "no-var": "error",
        "object-curly-spacing": ["error", "never"],
        "prefer-const": "error",
        quotes: ["error", "double"],
        semi: "off",
    },
}];