// Centralized enum-like strings. Every consumer spells these inline
// throughout the codebase; pulling them here means typos become import
// errors instead of silent runtime mismatches, and the canonical spellings
// live in one place. Keep this file dependency-free so any module can
// import it without cycles.

// localStorage keys. The `_corrupt_backup_` prefix is used dynamically in
// storage.js and not exported here — it's an implementation detail of the
// quarantine flow.
export const STORAGE_KEY = "grow_cycles";
export const STORAGE_VERSION_KEY = "grow_version";
export const ACTIVE_CYCLE_KEY = "active_cycle_id";
export const COLLAPSED_CYCLES_KEY = "collapsed_cycles";
export const COLLAPSED_WEEKS_KEY = "collapsed_weeks";
export const COLLAPSED_OBS_KEY = "collapsed_obs";
export const CYCLE_STAGE = { GROW: "grow", HARVEST: "harvest", COMPLETE: "complete" };
export const CYCLE_STAGE_DEFINITIONS = {
    [CYCLE_STAGE.GROW]: { label: "Grow", next: CYCLE_STAGE.HARVEST, badgeClass: "green-btn", advanceClass: "amber-btn", showsYield: false },
    [CYCLE_STAGE.HARVEST]: { label: "Harvest", next: CYCLE_STAGE.COMPLETE, badgeClass: "amber-btn", advanceClass: "complete-tag", showsYield: true },
    [CYCLE_STAGE.COMPLETE]: { label: "Complete", next: CYCLE_STAGE.GROW, badgeClass: "complete-tag", advanceClass: "green-btn", showsYield: true },
};
// Action types stored on each entry's `actions` array. The render layer
// (formatAction in utils.js) maps these back to display strings.
export const ACTION_TYPE = { LST: "lst", DEF: "def", REPOT: "repot", FLUSH: "flush", LIGHT: "light", HARVEST: "harvest" };

// Shared action metadata used by forms, logs and action formatting. Add or
// rename a standard plant action here instead of updating several views.
export const ACTION_DEFINITIONS = [
    { type: ACTION_TYPE.LST, label: "LST", pastLabel: "LST", icon: "lst", plantPicker: true },
    { type: ACTION_TYPE.DEF, label: "Defoliate", pastLabel: "Defoliated", icon: "scissors", plantPicker: true },
    { type: ACTION_TYPE.REPOT, label: "Repot / transplant", pastLabel: "Repotted / transplanted", icon: "scissors", plantPicker: true, formVisible: false },
    { type: ACTION_TYPE.FLUSH, label: "Flush", pastLabel: "Flushed", icon: "flush", plantPicker: true },
    { type: ACTION_TYPE.HARVEST, label: "Harvest", pastLabel: "Harvested", icon: "harvest", plantPicker: true, highlight: "amber" },
    { type: ACTION_TYPE.LIGHT, label: "Lights", pastLabel: "Light adjustment", icon: "lightBulb", plantPicker: false, formVisible: false },
];
export const ACTION_BY_TYPE = Object.fromEntries(ACTION_DEFINITIONS.map((action) => [action.type, action]));
export const FORM_PLANT_ACTIONS = ACTION_DEFINITIONS.filter((action) => action.plantPicker && action.formVisible !== false);
export const PLANT_ACTION_TYPES = new Set(ACTION_DEFINITIONS.filter((action) => action.plantPicker).map((action) => action.type));

// Plant types. "auto" = autoflower, "photo" = photoperiod. These are the
// canonical lowercase forms; migration code in storage.js also writes them
// out as raw strings when reading older data.
export const PLANT_TYPE = { AUTO: "auto", PHOTO: "photo" };
export const PLANT_TYPE_DEFINITIONS = {
    [PLANT_TYPE.AUTO]: { label: "AUTO", longLabel: "Autoflower", className: "auto", next: PLANT_TYPE.PHOTO },
    [PLANT_TYPE.PHOTO]: { label: "PHOTO", longLabel: "Photoperiod", className: "photo", next: PLANT_TYPE.AUTO },
};

export const PLANT_DETAIL_METRIC_SECTIONS = [
    {
        label: "Last 7 days",
        mutedZero: true,
        metrics: [
            { label: "Times fed", property: "feedCountLast7d" },
            { label: "Times watered", property: "waterCountLast7d" },
            { label: "Times LST'd", property: "lstCountLast7d" },
            { label: "Times defoliated", property: "defCountLast7d" },
            { label: "Times flushed", property: "flushCountLast7d" },
            { label: "Log entries", property: "logCountLast7d" },
        ],
    },
    {
        label: "Cycle recap",
        mutedZero: false,
        metrics: [
            { label: "Feed sessions", property: "feedCount" },
            { label: "Water sessions", property: "waterCount" },
            { label: "Times LST'd", property: "lstCount" },
            { label: "Times defoliated", property: "defCount" },
            { label: "Times flushed", property: "flushCount" },
        ],
    },
];

// Stats view modes. ACTIVE = current cycle only, ALL = every cycle stacked.
// "active" is the default; switching to a specific cycle replaces the mode
// with that cycle's id (an opaque string), so only ACTIVE/ALL are named.
export const STATS_MODE = { ACTIVE: "active", ALL: "all" };

// Sentinel plant-tab value used by the Add form when "All plants" is
// selected. Underscored so it can never collide with a real plant name
// (PLANT_NAME_RE allows letters/digits/space/dash/underscore, but the
// leading double-underscore is enough of a tell in code).
export const NUTRIENT_TAB_ALL = "__ALL__";

// localStorage value used for the "collapsed" flag. The non-collapsed
// state is "0"; loadCollapsedObs coerces a truthy check, so anything
// other than "1" is collapsed-false.
export const COLLAPSED_OBS_ON = "1";
export const COLLAPSED_OBS_OFF = "0";
