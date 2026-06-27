const handlers = {};
export function on(e, t, n) {
    (handlers[e] || (handlers[e] = {}), (handlers[e][t] = n));
}
function closeHeaderMenu() {
    const e = document.getElementById("header-menu"),
        t = document.getElementById("header-menu-btn");
    e && (e.classList.remove("open"), t.classList.remove("is-open"), t.setAttribute("aria-expanded", "false"));
}
function route(e) {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const n = t.dataset.action;
    t.closest("#header-menu") && "closeHeaderMenu" !== n && closeHeaderMenu();
    const o = handlers[n]?.[e.type];
    o && o(t, e);
}
(document.addEventListener("click", route), document.addEventListener("change", route), document.addEventListener("input", route));
export { closeHeaderMenu };
