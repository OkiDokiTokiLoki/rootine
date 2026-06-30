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
export const CYCLE_STAGE_LABEL = { grow: "Grow", harvest: "Harvest", complete: "Complete" };

// Plant types. "auto" = autoflower, "photo" = photoperiod. These are the
// canonical lowercase forms; migration code in storage.js also writes them
// out as raw strings when reading older data.
export const PLANT_TYPE = { AUTO: "auto", PHOTO: "photo" };

// Action types stored on each entry's `actions` array. The render layer
// (formatAction in utils.js) maps these back to display strings.
export const ACTION_TYPE = { LST: "lst", DEF: "def", REPOT: "repot", LIGHT: "light" };

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
