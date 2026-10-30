/**
 * Small-screen navigation for the existing CyberChef workspace.
 * The operations, recipe and editors stay mounted so their state is preserved.
 *
 * @license Apache-2.0
 */

const MOBILE_QUERY = "(max-width: 1023px)";
const PANELS = ["input", "operations", "recipe", "output"];

/**
 * Attach mobile interactions after the normal application listeners exist.
 * @param {App} app - The regular CyberChef application instance.
 */
export default function setupMobileLayout(app) {
    const media = window.matchMedia(MOBILE_QUERY);
    const nav = document.getElementById("mobile-nav");
    const menu = document.getElementById("mobile-menu");
    const menuToggle = document.getElementById("mobile-menu-toggle");
    const recList = document.getElementById("rec-list");

    /**
     * Show one workspace pane without unmounting any editors or operations.
     * @param {string} panel - The pane name.
     * @param {boolean} focusSearch - Whether to focus the operation search.
     */
    function showPanel(panel, focusSearch = false) {
        if (!PANELS.includes(panel)) return;

        for (const name of PANELS) {
            document.body.classList.toggle(`mobile-panel-${name}`, name === panel);
        }
        for (const button of nav.querySelectorAll("[data-mobile-panel]")) {
            button.setAttribute("aria-pressed", String(button.dataset.mobilePanel === panel));
        }

        if (focusSearch && media.matches) {
            document.getElementById("search").focus({preventScroll: true});
        }

        // CodeMirror and the recipe controls measure their containing pane.
        // Measure again after the newly selected pane becomes visible.
        window.requestAnimationFrame(() => {
            app.adjustComponentSizes();
            window.dispatchEvent(new Event("resize"));
        });
    }

    /** Close the mobile overflow menu. */
    function closeMenu() {
        menu.hidden = true;
        menuToggle.setAttribute("aria-expanded", "false");
    }

    nav.addEventListener("click", e => {
        const button = e.target.closest("[data-mobile-panel]");
        if (button) showPanel(button.dataset.mobilePanel);
    });

    document.getElementById("mobile-add-operation").addEventListener("click", () => {
        showPanel("operations", true);
    });

    // A mobile tap replaces the desktop-only double-click/drag-to-recipe flow.
    document.getElementById("operations").addEventListener("click", e => {
        if (!media.matches) return;
        const operation = e.target.closest(".op-list li.operation");
        if (!operation) return;

        app.manager.recipe.addOperation(operation.textContent.trim());
        showPanel("recipe");
        window.requestAnimationFrame(() => {
            recList.lastElementChild?.scrollIntoView({block: "nearest"});
        });
    });

    // Arrow buttons give recipe reordering a precise alternative to dragging.
    recList.addEventListener("click", e => {
        if (!media.matches) return;
        const button = e.target.closest(".mobile-recipe-actions button");
        if (!button) return;

        e.preventDefault();
        e.stopPropagation();
        const item = button.closest("li.operation");
        if (!item) return;

        if (button.classList.contains("mobile-remove-operation")) {
            item.remove();
            recList.dispatchEvent(app.manager.operationremove);
        } else if (button.classList.contains("mobile-move-up") && item.previousElementSibling) {
            recList.insertBefore(item, item.previousElementSibling);
            window.dispatchEvent(app.manager.statechange);
        } else if (button.classList.contains("mobile-move-down") && item.nextElementSibling) {
            recList.insertBefore(item.nextElementSibling, item);
            window.dispatchEvent(app.manager.statechange);
        }
    });

    const recipeCount = document.querySelector(".mobile-recipe-count");
    const updateRecipeCount = () => {
        const count = recList.querySelectorAll(":scope > li.operation").length;
        recipeCount.textContent = String(count);
        recipeCount.hidden = count === 0;
    };
    new MutationObserver(updateRecipeCount).observe(recList, {childList: true});
    updateRecipeCount();

    document.getElementById("mobile-bake").addEventListener("click", () => {
        document.getElementById("bake").click();
        showPanel("output");
    });

    menuToggle.addEventListener("click", () => {
        menu.hidden = !menu.hidden;
        menuToggle.setAttribute("aria-expanded", String(!menu.hidden));
    });
    menu.addEventListener("click", e => {
        const button = e.target.closest("[data-original-click]");
        if (!button) return;
        const target = button.dataset.originalClick;
        closeMenu();
        if (target === "download") {
            document.querySelector('#banner [data-target="#download-modal"]').click();
        } else {
            document.getElementById(target).click();
        }
    });
    document.addEventListener("click", e => {
        if (!e.target.closest(".mobile-menu-wrapper")) closeMenu();
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && !menu.hidden) {
            closeMenu();
            menuToggle.focus();
        }
    });

    // CodeMirror focuses its editor during startup, before any on-screen
    // keyboard is opened. Only a deliberate pointer interaction should hide
    // the bottom navigation; otherwise it would disappear on initial load.
    let userEditing = false;
    document.addEventListener("pointerdown", e => {
        userEditing = Boolean(e.target.closest("#input .cm-editor, #output .cm-editor"));
        document.body.classList.toggle("mobile-editing", userEditing && media.matches);
    });

    /** Free the navigation space while an input or output editor has focus. */
    function updateEditingState() {
        const editor = document.activeElement?.closest?.("#input .cm-editor, #output .cm-editor");
        if (!editor) userEditing = false;
        document.body.classList.toggle("mobile-editing", userEditing && Boolean(editor) && media.matches);
    }
    // Wait until the focus transition is complete before deciding whether
    // the editor was left. A focusout can fire before CodeMirror receives
    // focus, so an immediate check would incorrectly show the navigation.
    document.addEventListener("focusout", e => {
        // Blurring the operation search as the user taps the editor is not
        // leaving the editor; only an editor's own blur can end editing.
        if (e.target.closest?.("#input .cm-editor, #output .cm-editor")) {
            window.setTimeout(updateEditingState, 0);
        }
    });
    media.addEventListener("change", () => {
        closeMenu();
        updateEditingState();
        window.requestAnimationFrame(() => app.adjustComponentSizes());
    });
}
