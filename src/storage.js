import { seedCycles } from "./data.js";

// Each migration takes cycles, returns cycles. Migrations[0] is v1→v2, [1] is
// v2→v3, etc. To bump the version: write a function, append it. That's it.
const migrations = [
    // v1 → v2: ensure every cycle has a plants array. Older cycles didn't
    // track plants, so leave the array empty — the user adds plants through
    // the Plants modal rather than inheriting a hardcoded list.
    (cycles) =>
        cycles.map((c) => ({
            ...c,
            plants: c.plants || [],
        })),

    // v2 → v3: plantTypes went from "auto"/"photo" string to { type, repottedAt }.
    (cycles) =>
        cycles.map((c) => {
            const plantTypes = { ...(c.plantTypes || {}) };
            const fallback = c.startDate || new Date().toISOString().slice(0, 10);
            (c.plants || []).forEach((p) => {
                const raw = plantTypes[p];
                if (typeof raw === "string") {
                    plantTypes[p] = { type: raw, repottedAt: fallback };
                } else if (!raw || typeof raw !== "object") {
                    plantTypes[p] = { type: "auto", repottedAt: fallback };
                }
            });
            return { ...c, plantTypes };
        }),

    // v3 → v4: ensure every cycle has a favourites array. Plants the user
    // starred before this migration ran don't exist; users can re-star after
    // upgrade. We start empty rather than guessing.
    (cycles) =>
        cycles.map((c) => ({
            ...c,
            favourites: c.favourites || [],
        })),

    // v4 → v5: entries can carry observations tagged to specific plants
    // (entry.plantObs is a { "Plant Name": "note text" } map). Initialize
    // the field as an empty object on every entry so the rest of the code
    // can read it without checking for undefined.
    (cycles) =>
        cycles.map((c) => ({
            ...c,
            entries: (c.entries || []).map((e) => ({
                ...e,
                plantObs: e.plantObs && typeof e.plantObs === "object" ? e.plantObs : {},
            })),
        })),

    // v5 → v6: light defaults (lux / distance / lights-on / lights-off) used
    // to live under the localStorage key `light_defaults_<cycleId>`. They now
    // belong inside the cycle object itself so they round-trip through
    // export/import and don't depend on which tab is active when the user
    // types. The old keys are read once during migration and then dropped.
    (cycles) => {
        const stored = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("light_defaults_")) {
                const cycleId = key.slice("light_defaults_".length);
                try {
                    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
                    if (parsed && typeof parsed === "object") stored[cycleId] = parsed;
                } catch (e) {
                    // Ignore malformed legacy values; the cycle will simply
                    // start with no defaults.
                }
                localStorage.removeItem(key);
            }
        }
        return cycles.map((c) => {
            // Don't clobber an existing lightDefaults with the legacy key —
            // if the cycle was already migrated forward and has its own
            // value, keep that.
            const legacy = stored[c.id];
            if (c.lightDefaults && Object.keys(c.lightDefaults).length) {
                return c;
            }
            if (legacy && Object.keys(legacy).length) {
                return { ...c, lightDefaults: legacy };
            }
            return c;
        });
    },
];

const STORAGE_VERSION = migrations.length + 1;

function seed() {
    // Fresh install: deep-copy the seed and stamp the current version. The
    // seed is assumed to be authored in the current shape, so no migrations
    // run against it.
    const cycles = JSON.parse(JSON.stringify(seedCycles));
    localStorage.setItem("grow_cycles", JSON.stringify(cycles));
    localStorage.setItem("grow_version", String(STORAGE_VERSION));
    return cycles;
}

export function loadCycles() {
    const raw = localStorage.getItem("grow_cycles");
    if (!raw) return seed();

    let cycles = JSON.parse(raw);
    const version = parseInt(localStorage.getItem("grow_version") || "1", 10);

    // version is 1-indexed, so the v1→v2 migration is migrations[version - 1].
    for (let i = version - 1; i < migrations.length; i++) {
        cycles = migrations[i](cycles);
    }

    localStorage.setItem("grow_cycles", JSON.stringify(cycles));
    localStorage.setItem("grow_version", String(STORAGE_VERSION));
    return cycles;
}

export function saveCycles(cycles) {
    localStorage.setItem("grow_cycles", JSON.stringify(cycles));
}

export function loadActiveCycleId(cycles) {
    const stored = localStorage.getItem("active_cycle_id");
    if (stored && cycles.find((c) => c.id === stored)) return stored;
    return cycles[cycles.length - 1].id;
}

export function saveActiveCycleId(id) {
    localStorage.setItem("active_cycle_id", id);
}

export function loadCollapsedCycles() {
    return new Set(JSON.parse(localStorage.getItem("collapsed_cycles") || "[]"));
}

export function saveCollapsedCycles(set) {
    localStorage.setItem("collapsed_cycles", JSON.stringify([...set]));
}

export function loadCollapsedWeeks() {
    return new Set(JSON.parse(localStorage.getItem("collapsed_weeks") || "[]"));
}

export function saveCollapsedWeeks(set) {
    localStorage.setItem("collapsed_weeks", JSON.stringify([...set]));
}

export function loadCollapsedObs() {
    return localStorage.getItem("collapsed_obs") === "1";
}

export function saveCollapsedObs(state) {
    localStorage.setItem("collapsed_obs", state ? "1" : "0");
}
