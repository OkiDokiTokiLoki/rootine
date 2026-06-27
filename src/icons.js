// Centralised icon library. Every <svg> literal that used to be inlined in
// a render function (renderEntryCard, renderLog, renderPlantList,
// renderPlantObsList, renderNutrientList, renderPlantCard, …) now lives
// here, so a glyph tweak is a single edit instead of nine. The static
// SVGs in index.html (header menu, tab bar, light-status bulb) stay inline
// because they're server-rendered HTML; their path data isn't in JS code
// and would need a build step or runtime injection to move here.
//
// All Material-style glyphs use the same canvas (viewBox 0 -960 960 960)
// and inherit colour from the surrounding element via fill="currentColor"
// or stroke="currentColor", which is how blue-btn / red-btn / green-btn
// colour them.

const VIEW_BOX = "0 -960 960 960";
const NS = "http://www.w3.org/2000/svg";

// --- Material path data -------------------------------------------------
//
// Each value is the `d` attribute for one glyph. Grouped so a future
// outlined-vs-filled swap is a single edit per glyph.

const PATHS = {
    edit: "M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z",
    trash: "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z",
    duplicate: "M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z",

    // Badge glyphs (used inside <span class="badge badge-*">)
    lightBulb: "M400-240q-33 0-56.5-23.5T320-320v-50q-57-39-88.5-100T200-600q0-117 81.5-198.5T480-880q117 0 198.5 81.5T760-600q0 69-31.5 129.5T640-370v50q0 33-23.5 56.5T560-240H400Zm0-80h160v-92l34-24q41-28 63.5-71.5T680-600q0-83-58.5-141.5T480-800q-83 0-141.5 58.5T280-600q0 49 22.5 92.5T366-436l34 24v92Zm0 240q-17 0-28.5-11.5T360-120v-40h240v40q0 17-11.5 28.5T560-80H400Zm80-520Z",
    waterDrop: "M480-100q-133 0-226.5-92T160-416q0-63 24.5-120.5T254-638l226-222 226 222q45 44 69.5 101.5T800-416q0 132-93.5 224T480-100Zm170-148.5Q720-317 720-416q0-47-18-89.5T650-580L480-748 310-580q-34 32-52 74.5T240-416q0 99 70 167.5T480-180q100 0 170-68.5Z",
    feed: "M480-160q-56 0-105.5-17.5T284-227l-56 55q-11 11-28 11t-28-11q-11-11-11-28t11-28l55-55q-32-41-49.5-91T160-480q0-134 93-227t227-93h320v320q0 134-93 227t-227 93Zm0-80q100 0 170-70t70-170v-240H480q-100 0-170 70t-70 170q0 39 12 74.5t33 64.5l207-207q11-11 28-11t28 11q12 12 12 28.5T548-491L341-284q29 21 64.5 32.5T480-240Zm0-240Z",
    scissors: "M760-120 480-400l-94 94q8 15 11 32t3 34q0 66-47 113T240-80q-66 0-113-47T80-240q0-66 47-113t113-47q17 0 34 3t32 11l94-94-94-94q-15 8-32 11t-34 3q-66 0-113-47T80-720q0-66 47-113t113-47q66 0 113 47t47 113q0 17-3 34t-11 32l494 494v40H760ZM600-520l-80-80 240-240h120v40L600-520ZM296.5-663.5Q320-687 320-720t-23.5-56.5Q273-800 240-800t-56.5 23.5Q160-753 160-720t23.5 56.5Q207-640 240-640t56.5-23.5ZM494-466q6-6 6-14t-6-14q-6-6-14-6t-14 6q-6 6-6 14t6 14q6 6 14 6t14-6ZM296.5-183.5Q320-207 320-240t-23.5-56.5Q273-320 240-320t-56.5 23.5Q160-273 160-240t23.5 56.5Q207-160 240-160t56.5-23.5Z",
    note: "M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z",

    // Simpler water-drop variant used for the "set starting dilution"
    // button in the Nutrient Manager. Distinct path from badgeWater — it
    // draws the outline plus a single ripple instead of the shaded drop.
    waterDropLine: "M480-100q-133 0-226.5-92T160-416q0-63 24.5-120.5T254-638l226-222 226 222q45 44 69.5 101.5T800-416q0 132-93.5 224T480-100ZM240-416h480q0-47-18-89.5T650-580L480-748 310-580q-34 32-52 74.5T240-416Z",
};

// --- Low-level Material renderer ---------------------------------------

// Default size is 18×18 (matches the original edit/trash/duplicate markup).
// Pass `style` to emit an inline style attribute (used by the badge icons to
// override the .badge svg { fill: none } class rule).
function materialIcon(path, opts = {}) {
    if (opts.style) {
        return `<svg xmlns="${NS}" style="${opts.style}" viewBox="${VIEW_BOX}"><path d="${path}"/></svg>`;
    }
    const size = opts.size ?? 18;
    const width = opts.width ?? size;
    const height = opts.height ?? size;
    const wAttr = typeof width === "number" ? `${width}px` : width;
    const hAttr = typeof height === "number" ? `${height}px` : height;
    return `<svg xmlns="${NS}" height="${hAttr}" viewBox="${VIEW_BOX}" width="${wAttr}" fill="currentColor"><path d="${path}"/></svg>`;
}

// --- Common 18×18 button icons -----------------------------------------

export function edit(opts) {
    return materialIcon(PATHS.edit, opts);
}
export function trash(opts) {
    return materialIcon(PATHS.trash, opts);
}
export function duplicate(opts) {
    return materialIcon(PATHS.duplicate, opts);
}

// --- Badge icons --------------------------------------------------------
//
// All five render at 13×15 with fill:currentColor inlined on the SVG so the
// .badge svg class rule (fill: none / stroke: currentColor — outline style)
// doesn't take over and turn the badges into wireframes.

function badgeIcon(path) {
    return `<svg xmlns="${NS}" style="width:13px;height:15px;fill:currentColor;" viewBox="${VIEW_BOX}"><path d="${path}"/></svg>`;
}

export function badgeFeed() {
    return badgeIcon(PATHS.feed);
} // watering-can
export function badgeWater() {
    return badgeIcon(PATHS.waterDrop);
} // shaded drop
export function badgeLight() {
    return badgeIcon(PATHS.lightBulb);
} // lightbulb
export function badgeScissors() {
    return badgeIcon(PATHS.scissors);
}
export function badgeNote() {
    return badgeIcon(PATHS.note);
}

// --- One-off 18×18 icons used elsewhere in JS ---------------------------

export function waterDropLine(opts) {
    return materialIcon(PATHS.waterDropLine, opts);
}

// --- Lucide-style stroke icons (used by renderPlantList) ----------------

export function editStroke() {
    return `<svg viewBox="0 0 24 24" xmlns="${NS}" style="width:18px;height:18px;" fill="none"><path stroke="var(--blue)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 7.5l3 3M4 20v-3.5L15.293 5.207a1 1 0 011.414 0l2.086 2.086a1 1 0 010 1.414L7.5 20H4z"></path></svg>`;
}

export function trashStroke() {
    return `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--red);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
}

// --- Star (favourite) ---------------------------------------------------
//
// One polygon, five call sites: nutrient tabs, plant-obs tabs, plant list,
// plant detail header, and the stats plant card. The shape is identical
// everywhere; only the rendered size, fill state (filled vs outlined), and
// surrounding spacing differ.

const STAR_POLYGON = "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2";

export function star({ size = 11, filled = true, marginRight = null, verticalAlign = null } = {}) {
    const fill = filled ? "var(--amber)" : "none";
    const stroke = filled ? "var(--amber)" : "var(--muted)";
    const styles = [`width:${size}px`, `height:${size}px`, `fill:${fill}`, `stroke:${stroke}`, "flex-shrink:0", marginRight != null ? `margin-right:${marginRight}px` : null, verticalAlign != null ? `vertical-align:${verticalAlign}px` : null].filter(Boolean).join(";");
    return `<svg viewBox="0 0 24 24" xmlns="${NS}" style="${styles}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="${STAR_POLYGON}"/></svg>`;
}

// --- Chevron-down -------------------------------------------------------
//
// Same polyline points wherever it appears. `className` selects the size
// and stroke colour via CSS (chevron / week-chevron / section-chev); `id`
// and `style` cover the per-call overrides needed by the week and cycle
// headers (their chevrons need stable IDs so toggleWeek/toggleCycle can
// flip the .collapsed class).

const CHEVRON_POLYLINE = "6 9 12 15 18 9";

export function chevronDown({ className = "chevron", id = "", style = "" } = {}) {
    const idAttr = id ? ` id="${id}"` : "";
    const styleAttr = style ? ` style="${style}"` : "";
    return `<svg class="${className}"${idAttr} viewBox="0 0 24 24"${styleAttr}><polyline points="${CHEVRON_POLYLINE}"/></svg>`;
}

// --- Convenience namespace ----------------------------------------------

export const icon = {
    edit,
    trash,
    duplicate,
    editStroke,
    trashStroke,
    badgeFeed,
    badgeWater,
    badgeLight,
    badgeScissors,
    badgeNote,
    waterDropLine,
    star,
    chevronDown,
};
