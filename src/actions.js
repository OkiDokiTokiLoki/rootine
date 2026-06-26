// Event delegation for the whole app.
//
// Interactive elements carry data-action (plus any data-* args they need)
// instead of inline onclick="..." in rendered HTML. A single set of listeners
// on document routes clicks/changes/inputs to a registered handler. That means
// user-controlled strings (cycle names, plant names, entry IDs) never get
// interpolated into HTML attributes — the data-id we put in the attribute is
// the only thing passed across the boundary, and we escape it once at render
// time. No more .replace(/'/g, "\\'") chains per template.
//
// Register handlers anywhere; usually in main.js near the bottom:
//   on("editEntry", "click", (el) => editEntry(el.dataset.id));
//
// In templates:
//   <button data-action="editEntry" data-id="${escapeHtml(e.id)}">...</button>
//
// Two ways to use the header menu's "close on click" behavior without each
// handler having to remember to call it:
//   - data-action on an element inside #header-menu triggers closeHeaderMenu
//     automatically (see dispatcher below).
//   - data-action="closeHeaderMenu" works from anywhere for explicit close.

const handlers = {}; // { [action]: { click?: fn, change?: fn, input?: fn } }

export function on(action, eventType, fn) {
    if (!handlers[action]) handlers[action] = {};
    handlers[action][eventType] = fn;
}

function closeHeaderMenu() {
    const menu = document.getElementById("header-menu");
    const btn = document.getElementById("header-menu-btn");
    if (!menu) return;
    menu.classList.remove("open");
    btn.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
}

function route(e) {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const action = t.dataset.action;

    // Header menu items close the menu as part of their action.
    if (t.closest("#header-menu") && action !== "closeHeaderMenu") {
        closeHeaderMenu();
    }

    const fn = handlers[action]?.[e.type];
    if (fn) fn(t, e);
}

document.addEventListener("click", route);
document.addEventListener("change", route);
document.addEventListener("input", route);

export { closeHeaderMenu };
