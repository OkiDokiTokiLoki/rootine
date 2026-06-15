import { seedCycles } from "./data.js";

const STORAGE_VERSION = 2;
const DEFAULT_PLANTS = ["COP", "H", "GC", "GC2"];

export function loadCycles() {
    try {
        const stored = localStorage.getItem("grow_cycles");
        if (stored) {
            const parsed = JSON.parse(stored);
            parsed.forEach((c) => {
                if (!Array.isArray(c.plants)) c.plants = [...DEFAULT_PLANTS];
                if (!c.plantTypes || typeof c.plantTypes !== "object") c.plantTypes = {};
                c.plants.forEach((p) => {
                    // plantTypes used to be a flat "auto"/"photo" string. New
                    // shape is { type, repottedAt } so we can track the
                    // starting point for "age" stats.
                    const raw = c.plantTypes[p];
                    if (typeof raw === "string") {
                        c.plantTypes[p] = {
                            type: raw === "auto" || raw === "photo" ? raw : "auto",
                            repottedAt: c.startDate || new Date().toISOString().slice(0, 10),
                        };
                    } else if (!raw || typeof raw !== "object") {
                        c.plantTypes[p] = { type: "auto", repottedAt: c.startDate || new Date().toISOString().slice(0, 10) };
                    } else {
                        if (raw.type !== "auto" && raw.type !== "photo") raw.type = "auto";
                        if (!raw.repottedAt) raw.repottedAt = c.startDate || new Date().toISOString().slice(0, 10);
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
    // Seed plants also get the new shape
    cycles.forEach((c) => {
        c.plants.forEach((p) => {
            const raw = c.plantTypes[p];
            if (typeof raw === "string") {
                c.plantTypes[p] = { type: raw, repottedAt: c.startDate };
            } else if (!raw) {
                c.plantTypes[p] = { type: "auto", repottedAt: c.startDate };
            }
        });
    });
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
