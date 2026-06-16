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

export function loadLightDefaults(cycleId) {
    try {
        if (!cycleId) return {};
        return JSON.parse(localStorage.getItem("light_defaults_" + cycleId) || "{}");
    } catch (e) {
        return {};
    }
}

export function saveLightDefaults(cycleId, lux, dist, start, end) {
    if (!cycleId) return;
    localStorage.setItem("light_defaults_" + cycleId, JSON.stringify({ lux, dist, start, end }));
}
