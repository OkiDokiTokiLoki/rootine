import { seedCycles } from "./data.js";

const STORAGE_VERSION = 2;

export function loadCycles() {
    try {
        const version = parseInt(localStorage.getItem("grow_version") || "0");
        const stored = localStorage.getItem("grow_cycles");
        if (stored && version === STORAGE_VERSION) return JSON.parse(stored);
    } catch (e) {}
    const cycles = seedCycles.map((c) => ({ ...c, entries: [...c.entries] }));
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

export function loadCollapsedActions() {
    return JSON.parse(localStorage.getItem("collapsed_actions") || "true");
}

export function saveCollapsedActions(value) {
    localStorage.setItem("collapsed_actions", JSON.stringify(value));
}

export function loadLightDefaults() {
    try {
        return JSON.parse(localStorage.getItem("light_defaults") || "{}");
    } catch (e) {
        return {};
    }
}

export function saveLightDefaults(lux, dist) {
    localStorage.setItem("light_defaults", JSON.stringify({ lux, dist }));
}
