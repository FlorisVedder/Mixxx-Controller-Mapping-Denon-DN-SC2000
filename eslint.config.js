const js = require("@eslint/js");

/* Two JS environments live in this repository:
 * - the mapping script (root-level *.js) runs in Mixxx's QJSEngine (Qt JS):
 *   a classic script — no modules, no Node. The only globals are the ones
 *   Mixxx injects: engine, midi, script, components, console.
 * - eslint.config.js and tools/*.js are Node CommonJS.
 * midi-components-0-inout.js is a verbatim upstream copy of the PR library —
 * never lint it. */
module.exports = [
    js.configs.recommended,
    {
        ignores: ["node_modules/", "midi-components-0-inout.js"],
    },
    {
        /* The mapping script only — per the repo standard exactly one
         * <Controller>-scripts.js per repository. A bare "*.js" glob would
         * also match eslint.config.js and tools/ (flat-config patterns
         * without a slash match basenames at any depth). */
        files: ["*-scripts.js"],
        languageOptions: {
            /* Engine level for the declared Mixxx 2.6+ target: ES2017 —
             * anything newer must be verified against the manual for the
             * declared mixxxVersion first. */
            ecmaVersion: 2017,
            sourceType: "script",
            globals: {
                engine: "readonly",
                midi: "readonly",
                script: "readonly",
                components: "readonly",
                print: "readonly",
                console: "readonly",
            },
        },
        rules: {
            /* ALL_CAPS names are the hardware constant tables (LED_ON,
             * ENCODER_LEFT, ...) — in-code documentation of wire values;
             * not every constant is referenced. */
            "no-unused-vars": ["error", {varsIgnorePattern: "^[A-Z][A-Z0-9_]*$"}],
        },
    },
    {
        files: ["eslint.config.js", "tools/**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                console: "readonly",
                process: "readonly",
                require: "readonly",
                module: "readonly",
                exports: "readonly",
                __dirname: "readonly",
                Buffer: "readonly",
            },
        },
    },
];
