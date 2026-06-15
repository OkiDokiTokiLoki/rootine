import { seedCycles } from "./data.js";

const STORAGE_VERSION = 2;
const DEFAULT_PLANTS = ["COP", "H", "GC", "GC2"];

export function loadCycles() {
    try {
        const stored = localStorage.getItem("grow_cycles");
        if (stored) {
            const parsed = JSON.parse(stored);
            // Migration: ensure every cycle has a plants array AND a plantTypes map.
            // Older saves didn't carry plantTypes, so we fill in safe defaults
            // rather than wiping user history. We persist the migrated shape back
            // to localStorage so the migration only runs once.
            parsed.forEach((c) => {
                if (!Array.isArray(c.plants)) c.plants = [...DEFAULT_PLANTS];
                if (!c.plantTypes || typeof c.plantTypes !== "object") c.plantTypes = {};
                // Any plant missing a type gets 'photo'. Photoperiod is the
                // conservative pick for legacy grows; the user can flip
                // individual plants to 'auto' from the Plants modal.
                c.plants.forEach((p) => {
                    if (c.plantTypes[p] !== "auto" && c.plantTypes[p] !== "photo") {
                        c.plantTypes[p] = "auto";
                    }
                });
            });
            localStorage.setItem("grow_cycles", JSON.stringify(parsed));
            localStorage.setItem("grow_version", String(STORAGE_VERSION));
            return parsed;
        }
    } catch (e) {}
    // Fresh seed
    const cycles = seedCycles.map((c) => ({
        ...c,
        plants: Array.isArray(c.plants) ? [...c.plants] : [...DEFAULT_PLANTS],
        plantTypes: c.plantTypes && typeof c.plantTypes === "object" ? { ...c.plantTypes } : {},
        entries: [...c.entries],
    }));
    localStorage.setItem("grow_cycles", JSON.stringify(cycles));
    localStorage.setItem("grow_version", String(STORAGE_VERSION));
    return cycles;
}

export function saveCycles(cycles) {
    localStorage.setItem("grow_cycles", JSON.stringify(cycles));
}

export function loadActiveCycleId(cycles) {
    const stored = localStorage.getItem("active_cycle_id");
    // Fall back to last cycle if stored id not found
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

export function loadLightDefaults() {
    try {
        return JSON.parse(localStorage.getItem("light_defaults") || "{}");
    } catch (e) {
        return {};
    }
}

export function saveLightDefaults(lux, dist, start, end) {
    localStorage.setItem("light_defaults", JSON.stringify({ lux, dist, start, end }));
}
