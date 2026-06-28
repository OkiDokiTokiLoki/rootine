import { STORAGE_KEY, STORAGE_VERSION_KEY, ACTIVE_CYCLE_KEY, COLLAPSED_CYCLES_KEY, COLLAPSED_WEEKS_KEY, COLLAPSED_OBS_KEY, COLLAPSED_OBS_ON, COLLAPSED_OBS_OFF } from "./constants.js";

// Each migration takes cycles, returns cycles. Migrations[0] is v1→v2, [1] is
// v2→v3, etc. To bump the version: write a function, append it. That's it.

// Helpers for the v8 → v9 migration. Actions used to be display strings
// ("LST (Plant A, Plant B)"), which forced the rest of the code to
// regex-parse them back into structured form every time it read an
// entry, and regex-rewrite them on plant rename. The migration
// converts once-and-for-all; everything downstream reads objects.
function migrateActionString(a) {
    if (a == null || typeof a === "object") return a;
    if (typeof a !== "string") return a;

    let m;

    // LST (Plant A, Plant B) — possibly no parens at all
    if ((m = a.match(/^LST\s*(?:\((.*)\))?\s*$/))) {
        return { type: "lst", plants: parseLegacyPlantList(m[1]) };
    }

    // Defoliate (Plant A, Plant B)
    if ((m = a.match(/^Defoliate\s*(?:\((.*)\))?\s*$/))) {
        return { type: "def", plants: parseLegacyPlantList(m[1]) };
    }

    // Repot / transplant (Plant A, Plant B)
    if ((m = a.match(/^Repot \/ transplant\s*(?:\((.*)\))?\s*$/))) {
        return { type: "repot", plants: parseLegacyPlantList(m[1]) };
    }

    // Light adjusted (30k lux, 30cm, 18:00–06:00)
    if ((m = a.match(/^Light adjusted\s*(?:\((.*)\))?\s*$/))) {
        const out = { type: "light", lux: null, dist: null, start: null, end: null };
        if (m[1]) {
            m[1].split(", ").forEach((part) => {
                if (part.includes("lux")) out.lux = part.replace("k lux", "").trim();
                else if (part.includes("cm")) out.dist = part.replace("cm", "").trim();
                else if (part.includes("–")) {
                    const [start, end] = part.split("–");
                    out.start = start.trim();
                    out.end = end.trim();
                }
            });
        }
        return out;
    }

    // Unrecognized string — leave alone so formatAction's defensive
    // fallback can decide what to do.
    return a;
}

function parseLegacyPlantList(s) {
    if (!s || s === "All plants") return [];
    return s
        .split(", ")
        .map((p) => p.trim())
        .filter(Boolean);
}

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

    // v6 → v7: nutrients become a per-cycle list, and entry plant data
    // moves to a nested structure. Old data had hardcoded fish/grow/bloom
    // keys at the top level of each plant's data. Migrate to:
    //   cycle.nutrients: [{ name: "Fish" }, ...]
    //   entry.plants[name]: { nutrients: { Fish: 1 }, concentrations: { Fish: 5 }, water: 2 }
    // Cycles with no fish/grow/bloom data start with an empty nutrient list
    // — the user adds nutrients via the Nutrient Manager.
    (cycles) => {
        const NAMES = ["Fish", "Grow", "Bloom"];
        return cycles.map((c) => {
            // Already migrated (or freshly created). Just make sure the
            // nutrients field exists so downstream code can read it without
            // a type check.
            if (Array.isArray(c.nutrients)) {
                return c;
            }

            // Inspect every entry's plant data to figure out which of the
            // three legacy nutrients were actually used. Only those become
            // entries in the new per-cycle nutrient list, so cycles that
            // only used water stay nutrient-less until the user adds some.
            const used = new Set();
            (c.entries || []).forEach((e) => {
                Object.values(e.plants || {}).forEach((p) => {
                    if (p.fish || p.fishConc) used.add("Fish");
                    if (p.grow || p.growConc) used.add("Grow");
                    if (p.bloom || p.bloomConc) used.add("Bloom");
                });
            });

            // Preserve order (Fish, Grow, Bloom) when adding defaults so the
            // colour mapping stays stable for users with existing data.
            const nutrients = NAMES.filter((n) => used.has(n)).map((name) => ({ name }));

            // Migrate each entry's plant data into the nested structure.
            // The old keys are not copied through — anything that's not
            // water/fish/grow/bloom/fishConc/growConc/bloomConc is dropped,
            // since the previous versions didn't have any other fields.
            const newEntries = (c.entries || []).map((e) => {
                if (!e.plants) return e;
                const newPlants = {};
                Object.entries(e.plants).forEach(([plantName, data]) => {
                    const newNutrients = {};
                    const newConcentrations = {};
                    NAMES.forEach((name) => {
                        const lower = name.toLowerCase();
                        if (data[lower]) newNutrients[name] = data[lower];
                        const concKey = lower + "Conc";
                        if (data[concKey]) newConcentrations[name] = data[concKey];
                    });
                    const newData = {};
                    if (data.water) newData.water = data.water;
                    if (Object.keys(newNutrients).length > 0) newData.nutrients = newNutrients;
                    if (Object.keys(newConcentrations).length > 0) newData.concentrations = newConcentrations;
                    if (Object.keys(newData).length > 0) newPlants[plantName] = newData;
                });
                return { ...e, plants: newPlants };
            });

            return { ...c, nutrients, entries: newEntries };
        });
    },

    // v7 → v8: nutrients carry an optional default concentration (ml/l)
    // that seeds the Add form and acts as a fallback for "Latest
    // concentration" in the Plant Detail modal when no log entry has
    // recorded one yet. Existing nutrients start with no default.
    (cycles) =>
        cycles.map((c) => ({
            ...c,
            nutrients: Array.isArray(c.nutrients) ? c.nutrients.map((n) => ({ defaultConcentration: null, ...n })) : c.nutrients,
        })),

    // v8 → v9: entry actions become structured objects instead of display
    // strings. The old format ("LST (Plant A, Plant B)") had to be
    // regex-parsed to read back which plants were tagged, and regex-
    // rewritten on plant rename with another regex. The new format keys
    // off `type` and stores the plant list directly; render-time
    // formatting is the only string logic left in the rest of the code.
    (cycles) =>
        cycles.map((c) => ({
            ...c,
            entries: (c.entries || []).map((e) => ({
                ...e,
                actions: (e.actions || []).map(migrateActionString),
            })),
        })),
];

const STORAGE_VERSION = migrations.length + 1;

function seed() {
    localStorage.setItem(STORAGE_KEY, "[]");
    localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
    return [];
}

export function loadCycles() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();

    let cycles;
    try {
        cycles = JSON.parse(raw);
    } catch {
        quarantineCorruptData(raw);
        return seed();
    }

    if (!isValidCyclesShape(cycles)) {
        quarantineCorruptData(raw);
        return seed();
    }

    const version = parseInt(localStorage.getItem(STORAGE_VERSION_KEY) || "1", 10);
    for (let i = version - 1; i < migrations.length; i++) {
        cycles = migrations[i](cycles);
    }

    if (!isValidCyclesShape(cycles)) {
        quarantineCorruptData(raw);
        return seed();
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cycles));
    localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
    return cycles;
}

export function isValidCyclesShape(cycles) {
    if (!Array.isArray(cycles)) return false;
    for (const c of cycles) {
        if (c === null || typeof c !== "object" || Array.isArray(c)) return false;
        if (typeof c.id !== "string") return false;
        if (typeof c.name !== "string") return false;
        if (typeof c.startDate !== "string") return false;
        if (!Array.isArray(c.entries)) return false;
        for (const e of c.entries) {
            if (e === null || typeof e !== "object" || Array.isArray(e)) return false;
            if (typeof e.id !== "string") return false;
            if (typeof e.dt !== "string") return false;
        }
    }
    return true;
}

function quarantineCorruptData(raw) {
    try {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        localStorage.setItem(`_corrupt_backup_${stamp}`, raw);
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith("_corrupt_backup_")) keys.push(k);
        }
        keys.sort();
        while (keys.length > 3) {
            localStorage.removeItem(keys.shift());
        }
    } catch {
        // Even if the quarantine write fails (quota, etc.), the caller
        // will fall through to seed() and the app will still boot.
    }
}

export function saveCycles(cycles) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cycles));
}

export function loadActiveCycleId(cycles) {
    if (!cycles.length) return null;
    const stored = localStorage.getItem(ACTIVE_CYCLE_KEY);
    if (stored && cycles.find((c) => c.id === stored)) return stored;
    return cycles[cycles.length - 1].id;
}

export function saveActiveCycleId(id) {
    if (id == null) {
        localStorage.removeItem(ACTIVE_CYCLE_KEY);
    } else {
        localStorage.setItem(ACTIVE_CYCLE_KEY, id);
    }
}

export function loadCollapsedCycles() {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_CYCLES_KEY) || "[]"));
}

export function saveCollapsedCycles(set) {
    localStorage.setItem(COLLAPSED_CYCLES_KEY, JSON.stringify([...set]));
}

export function loadCollapsedWeeks() {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_WEEKS_KEY) || "[]"));
}

export function saveCollapsedWeeks(set) {
    localStorage.setItem(COLLAPSED_WEEKS_KEY, JSON.stringify([...set]));
}

export function loadCollapsedObs() {
    return localStorage.getItem(COLLAPSED_OBS_KEY) === COLLAPSED_OBS_ON;
}

export function saveCollapsedObs(state) {
    localStorage.setItem(COLLAPSED_OBS_KEY, state ? COLLAPSED_OBS_ON : COLLAPSED_OBS_OFF);
}
