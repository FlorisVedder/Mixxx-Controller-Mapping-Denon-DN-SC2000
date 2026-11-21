#!/usr/bin/env node
/**
 * dump-bindings — snapshot the resolved MIDI bindings of the mapping.
 *
 * Wire-neutrality gate for the layout migration (standard §3).
 *
 * The script loads the components library and the mapping script exactly like
 * Mixxx does (the <scriptfiles> order of the preset XML), runs the mapping's
 * init() with stubbed engine/midi objects, then walks every container and
 * component the way reconnectComponents does — and prints one line per
 * component with its resolved bindings and Mixxx targets.
 *
 * Usage (from the repository root):
 *
 *     node tools/dump-bindings.js > tools/bindings-baseline.txt
 *         Write a snapshot (redirect to a file; a baseline is committed with
 *         the repository so the gate works on every checkout).
 *
 *     node tools/dump-bindings.js --compare tools/bindings-baseline.txt
 *         Gate mode: exit status 0 if the current state matches the file,
 *         exit status 1 with a diff on stderr otherwise.
 *
 *     node tools/dump-bindings.js --set blueDeck=3
 *         Override a preset setting before init (repeatable). Defaults come
 *         from the <settings> block of the XML, so the snapshot stays in sync
 *         with the shipped defaults.
 *
 * The snapshot captures the init-time (unshifted) state, after init() has run
 * and every container has connected. It is deterministic: same code plus same
 * settings always produce the same text. Shift bodies that rebind inKey at
 * runtime are code paths, not init-time bindings, so they are not part of the
 * snapshot — the snapshot proves the wiring did not change, not that the
 * mapping is correct.
 *
 * Warnings and the input-handler cross-check go to stderr; the table on
 * stdout is the snapshot. The cross-check closes the loop between what the
 * mapping registered (254 handlers on DN init) and what the walk found:
 *
 *     # input-handlers: registered N, live L, walked-live L, stale S,
 *     # all accounted
 *
 * Stale entries are disconnected handlers that Component.disconnect() left
 * in component.inputHandlers (the entries are dead in the engine, but the
 * library never empties the array). Only live handler ids count as walked.
 */

"use strict";

const fs = require("fs");
const vm = require("vm");

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage() {
    return "usage: node tools/dump-bindings.js [--set name=value ...] [--compare FILE]\n" +
        "       node tools/dump-bindings.js --help";
}

function parseArgs(argv) {
    const options = {settings: {}, compareFile: null, help: false};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--help" || arg === "-h") {
            options.help = true;
        } else if (arg === "--set") {
            const pair = argv[++i];
            if (pair === undefined || !/^[^=]+=.+$/.test(pair)) {
                fail("--set needs a name=value argument");
            }
            const equals = pair.indexOf("=");
            options.settings[pair.slice(0, equals)] = pair.slice(equals + 1);
        } else if (arg === "--compare") {
            const file = argv[++i];
            if (file === undefined) {
                fail("--compare needs a file argument");
            }
            options.compareFile = file;
        } else {
            fail("unknown argument: " + arg);
        }
    }
    return options;
}

function fail(message) {
    process.stderr.write("dump-bindings: " + message + "\n" + usage() + "\n");
    process.exit(2);
}

// ---------------------------------------------------------------------------
// Preset XML parsing — the *.midi.xml next to the scripts is the entry point.
// ---------------------------------------------------------------------------

function findPresetXml() {
    const files = fs.readdirSync(".").filter((name) => name.endsWith(".midi.xml"));
    if (files.length === 0) {
        fail("no *.midi.xml found in the working directory");
    }
    if (files.length > 1) {
        fail("multiple *.midi.xml files found: " + files.join(", "));
    }
    return files[0];
}

function parsePreset(xmlText, settingsOverrides) {
    const preset = {
        presetName: "unknown",
        functionPrefix: null,
        scriptFiles: [],
        settings: {},
    };

    const nameMatch = xmlText.match(/<name>([^<]*)<\/name>/);
    if (nameMatch !== null) {
        preset.presetName = nameMatch[1].trim();
    }

    /* <scriptfiles> entries in document order — Mixxx loads them in this
     * order, and the library must come before the mapping that uses it. */
    const scriptfilesMatch = xmlText.match(/<scriptfiles>([\s\S]*?)<\/scriptfiles>/);
    if (scriptfilesMatch === null) {
        fail("no <scriptfiles> block in the preset XML");
    }
    for (const fileTag of scriptfilesMatch[1].matchAll(/<file\s+([^>]*)\/>/g)) {
        const filename = fileTag[1].match(/filename="([^"]*)"/);
        if (filename === null) {
            continue;
        }
        preset.scriptFiles.push(filename[1]);
        const prefix = fileTag[1].match(/functionprefix="([^"]*)"/);
        if (prefix !== null) {
            preset.functionPrefix = prefix[1];
        }
    }

    /* Settings defaults. Integer options carry a default attribute; enum
     * options mark the default <value> child with default="true". Mixxx
     * exports the value as a string; keep that behaviour. */
    for (const optionTag of xmlText.matchAll(/<option\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/option>)/g)) {
        const attrs = optionTag[1];
        const variable = attrs.match(/variable="([^"]*)"/);
        if (variable === null) {
            continue;
        }
        const type = (attrs.match(/type="([^"]*)"/) || [null, null])[1];
        if (type === "integer") {
            const def = attrs.match(/default="([^"]*)"/);
            if (def !== null) {
                preset.settings[variable[1]] = def[1];
            }
        } else if (type === "enum" && optionTag[2] !== undefined) {
            const defValue = optionTag[2].match(/<value[^>]*default="true"[^>]*>([^<]*)<\/value>/);
            if (defValue !== null) {
                preset.settings[variable[1]] = defValue[1].trim();
            }
        }
    }

    for (const [name, value] of Object.entries(settingsOverrides)) {
        preset.settings[name] = value;
    }
    return preset;
}

// ---------------------------------------------------------------------------
// Mixxx environment stubs: enough surface for the library and init().
// ---------------------------------------------------------------------------

const handlerRegistry = {
    registered: 0,
    live: new Map(), /* id -> {status, control} */
};
let handlerSequence = 0;

function makeMidiStub() {
    return {
        sendShortMsg() {},
        makeInputHandler(status, control) {
            handlerSequence += 1;
            handlerRegistry.registered += 1;
            const id = handlerSequence;
            handlerRegistry.live.set(id, {status: status, control: control});
            return {
                id: id,
                disconnect() {
                    handlerRegistry.live.delete(id);
                },
            };
        },
    };
}

function makeEngineStub(settings) {
    return {
        getSetting(name) {
            return settings[name];
        },
        getValue() {
            return 0;
        },
        setValue() {},
        getParameter() {
            return 0;
        },
        setParameter() {},
        makeConnection(group, key, callback) {
            return {
                disconnect() {},
                isConnected: true,
                trigger() {
                    callback.call(null, 0, group);
                },
            };
        },
        softTakeover() {},
        softTakeoverIgnoreNextValue() {},
        beginTimer() {
            return 0;
        },
        stopTimer() {},
        scratchEnable() {},
        scratchDisable() {},
        scratchTick() {},
        isScratching() {
            return 0;
        },
    };
}

/* The global `script` object the library expects from Mixxx. */
const scriptStub = {
    channelRegEx: /\[Channel(\d+)]/,
    deckFromGroup(group) {
        const match = /\[Channel(\d+)]/.exec(group);
        return match === null ? -1 : parseInt(match[1], 10);
    },
    effectUnitRegEx: /\[EffectRack1_EffectUnit(\d+)]/,
    individualEffectRegEx: /\[EffectRack1_EffectUnit(\d+)_Effect(\d+)]/,
};

function makeConsoleStub() {
    return {
        log() {},
        warn(text) {
            process.stderr.write("dump-bindings [console.warn] " + text + "\n");
        },
        error(text) {
            process.stderr.write("dump-bindings [console.error] " + text + "\n");
        },
        assert(condition, text) {
            if (!condition) {
                process.stderr.write("dump-bindings [console.assert] " + text + "\n");
            }
        },
    };
}

// ---------------------------------------------------------------------------
// Load + run: the sandbox mirrors what Mixxx's ControllerEngine provides.
// ---------------------------------------------------------------------------

function loadSandbox(preset) {
    const sandbox = {
        engine: makeEngineStub(preset.settings),
        midi: makeMidiStub(),
        script: scriptStub,
        console: makeConsoleStub(),
    };
    vm.createContext(sandbox);
    for (const filename of preset.scriptFiles) {
        const code = fs.readFileSync(filename, "utf8");
        vm.runInContext(code, sandbox, {filename: filename});
    }
    if (preset.functionPrefix === null || sandbox[preset.functionPrefix] === undefined) {
        fail("could not find the mapping object (functionprefix missing or wrong)");
    }
    return sandbox;
}

// ---------------------------------------------------------------------------
// Walk — the same members reconnectComponents sees: own enumerable
// properties, containers recursed, arrays of components flattened.
// ---------------------------------------------------------------------------

function walk(sandbox, functionPrefix) {
    const rows = [];
    const warnings = [];
    const handlerIdsSeen = new Set();
    const visited = new Set();

    const lib = sandbox.components;
    const isContainer = (obj) => obj instanceof lib.ComponentContainer;
    const isComponent = (obj) => obj instanceof lib.Component;

    function formatHex(byte) {
        return "0x" + byte.toString(16).toUpperCase().padStart(2, "0");
    }

    function formatPairs(pairs) {
        return pairs.map((pair) => "[" + formatHex(pair[0]) + ", " + formatHex(pair[1]) + "]").join(" ");
    }

    /* Object-form midiIn/midiOut (after normalizeNestedMidi) is a sparse
     * array keyed by the property names given in the mapping ({msb, lsb},
     * {wheel, touch}); `0 in midi` is false only for that form — and its
     * length is 0, since the keys are non-numeric. */
    function formatMidi(midi) {
        if (midi === undefined || midi === null || !Array.isArray(midi)) {
            return "-";
        }
        if (0 in midi) {
            return formatPairs(midi);
        }
        const keys = Object.keys(midi);
        if (keys.length === 0) {
            return "-";
        }
        return keys
            .map((key) => key + ": " + formatPairs(midi[key]))
            .join("  ");
    }

    function propertyOrDash(component, name) {
        const value = component[name];
        return value === undefined || value === null ? "-" : String(value);
    }

    function record(component, componentPath) {
        try {
            const row = {
                name: componentPath,
                path: componentPath,
                group: propertyOrDash(component, "group"),
                inKey: propertyOrDash(component, "inKey"),
                outKey: propertyOrDash(component, "outKey"),
                midiIn: formatMidi(component.midiIn),
                midiOut: formatMidi(component.midiOut),
                led: typeof component.led === "number" ? formatHex(component.led) : "-",
            };
            rows.push(row);
            if (row.midiIn === "-" && row.midiOut === "-") {
                warnings.push(componentPath + " has neither midiIn nor midiOut");
            }
            for (const handler of component.inputHandlers) {
                /* inputHandlers keeps disconnected (stale) entries —
                 * a library quirk — so only live ids count as walked. */
                if (handlerRegistry.live.has(handler.id)) {
                    handlerIdsSeen.add(handler.id);
                }
            }
        } catch (error) {
            warnings.push(componentPath + " could not be read: " + error.message);
        }
    }

    function walkContainer(container, containerPath) {
        if (visited.has(container)) {
            warnings.push("container cycle at " + containerPath);
            return;
        }
        visited.add(container);
        /* Own enumerable properties only — the same members
         * reconnectComponents walks and connects. */
        for (const name of Object.keys(container)) {
            const member = container[name];
            const memberPath = containerPath + "." + name;
            if (isContainer(member)) {
                walkContainer(member, memberPath);
            } else if (isComponent(member)) {
                record(member, memberPath);
            } else if (Array.isArray(member)) {
                member.forEach((element, index) => {
                    const elementPath = memberPath + "[" + index + "]";
                    if (isContainer(element)) {
                        walkContainer(element, elementPath);
                    } else if (isComponent(element)) {
                        record(element, elementPath);
                    }
                });
            }
        }
    }

    const root = sandbox[functionPrefix];
    for (const name of Object.keys(root)) {
        const member = root[name];
        if (isContainer(member)) {
            walkContainer(member, name);
        } else if (isComponent(member)) {
            record(member, name);
        }
    }

    return {rows: rows, warnings: warnings, handlerIdsSeen: handlerIdsSeen};
}

// ---------------------------------------------------------------------------
// Output: a deterministic, diff-friendly table plus registry cross-check.
// ---------------------------------------------------------------------------

const COLUMN_WIDTHS = [27, 35, 26, 26, 55, 14, 4];

function renderTable(preset, rows) {
    const lines = [];
    lines.push("# dump-bindings snapshot (" + preset.presetName + ")");
    lines.push("# settings: " + Object.keys(preset.settings).sort()
        .map((name) => name + "=" + preset.settings[name]).join(" "));
    for (const row of rows.slice().sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
        const cells = [row.path, row.group, row.inKey, row.outKey, row.midiIn, row.midiOut, row.led];
        lines.push(cells.map((cell, index) =>
            cell.padEnd(COLUMN_WIDTHS[index])).join("").trimEnd());
    }
    return lines.join("\n") + "\n";
}

function crossCheck(collected) {
    const lines = [];
    lines.push("# components: " + collected.rows.length);
    for (const warning of collected.warnings) {
        lines.push("# warning: " + warning);
    }
    const unaccounted = [];
    for (const [id, binding] of handlerRegistry.live) {
        if (!collected.handlerIdsSeen.has(id)) {
            unaccounted.push(formatHex(binding.status) + " " + formatHex(binding.control));
        }
    }
    lines.push("# input-handlers: registered " + handlerRegistry.registered
        + ", live " + handlerRegistry.live.size
        + ", walked-live " + collected.handlerIdsSeen.size
        + ", stale " + (handlerRegistry.registered - handlerRegistry.live.size)
        + (unaccounted.length === 0 ? ", all accounted"
                                    : ", UNACCOUNTED " + unaccounted.join(", ")));
    /* formatHex lives inside walk(); keep an independent copy here. */
    function formatHex(byte) {
        return "0x" + byte.toString(16).toUpperCase().padStart(2, "0");
    }
    return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Compare — the wire-neutrality gate.
// ---------------------------------------------------------------------------

/* Longest-common-subsequence line diff; changed rows are printed as
 * unified-style -/+ pairs (the table is sorted, so hunks stay local). */
function lcsDiff(expected, actual) {
    const n = expected.length;
    const m = actual.length;
    const table = Array.from({length: n + 1}, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            table[i][j] = expected[i] === actual[j]
                ? table[i + 1][j + 1] + 1
                : Math.max(table[i + 1][j], table[i][j + 1]);
        }
    }
    const diff = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (expected[i] === actual[j]) {
            i++;
            j++;
        } else if (table[i + 1][j] >= table[i][j + 1]) {
            diff.push("- " + expected[i]);
            i++;
        } else {
            diff.push("+ " + actual[j]);
            j++;
        }
    }
    while (i < n) {
        diff.push("- " + expected[i]);
        i++;
    }
    while (j < m) {
        diff.push("+ " + actual[j]);
        j++;
    }
    return diff;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        process.stdout.write(usage() + "\n");
        return 0;
    }
    const preset = parsePreset(fs.readFileSync(findPresetXml(), "utf8"), options.settings);
    const sandbox = loadSandbox(preset);
    vm.runInContext(preset.functionPrefix + ".init();", sandbox);
    const collected = walk(sandbox, preset.functionPrefix);

    const checks = crossCheck(collected);
    process.stderr.write("dump-bindings: " + checks.split("\n").join("\ndump-bindings: ") + "\n");

    if (options.compareFile === null) {
        process.stdout.write(renderTable(preset, collected.rows));
        return 0;
    }

    let expectedText;
    try {
        expectedText = fs.readFileSync(options.compareFile, "utf8");
    } catch (error) {
        fail("cannot read " + options.compareFile + ": " + error.message);
    }
    const actualLines = renderTable(preset, collected.rows).split("\n").filter((line) => line !== "");
    const expectedLines = expectedText.split("\n").filter((line) => line !== "");
    const diff = lcsDiff(expectedLines, actualLines);
    if (diff.length === 0) {
        process.stdout.write("[gate] PASS — bindings identical to " + options.compareFile + "\n");
        return 0;
    }
    process.stderr.write("[gate] FAIL — bindings differ from " + options.compareFile + ":\n");
    process.stderr.write(diff.join("\n") + "\n");
    return 1;
}

process.exit(main());
