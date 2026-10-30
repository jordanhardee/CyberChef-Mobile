/**
 * Production-browser smoke test for the responsive CyberChef UI.
 *
 * Start a server serving build/prod on port 8000 and run:
 * CYBERCHEF_CHROME_BIN=/path/to/chrome npm run test:mobile
 *
 * @license Apache-2.0
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {Builder, By, until} = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

const baseURL = process.env.CYBERCHEF_TEST_URL || "http://127.0.0.1:8000/index.html";
const browserPath = process.env.CYBERCHEF_CHROME_BIN;
const screenshotDirectory = process.env.CYBERCHEF_SCREENSHOT_DIR;
const chromeOptions = new chrome.Options()
    .addArguments("--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,900");

if (browserPath) chromeOptions.setChromeBinaryPath(browserPath);

/**
 * Change the browser's real CSS layout viewport and enable touch input.
 * @param {WebDriver} driver - The active Chrome driver.
 * @param {number} width - CSS viewport width.
 * @param {number} height - CSS viewport height.
 */
async function viewport(driver, width, height) {
    await driver.sendDevToolsCommand("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: width < 1024
    });
    await driver.sendDevToolsCommand("Emulation.setTouchEmulationEnabled", {
        enabled: width < 1024,
        maxTouchPoints: 5
    });
}

/**
 * Dispatch a real touch sequence in CSS viewport coordinates.
 * @param {WebDriver} driver - The active Chrome driver.
 * @param {string} selector - The element to tap.
 */
async function tap(driver, selector) {
    const point = await driver.executeScript(query => {
        const rect = document.querySelector(query).getBoundingClientRect();
        return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
    }, selector);
    await driver.sendDevToolsCommand("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [point]
    });
    await driver.sendDevToolsCommand("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: []
    });
}

/**
 * Swipe upward starting on a real operation row, recording if SortableJS
 * mistakenly starts the desktop drag gesture instead of allowing scrolling.
 * @param {WebDriver} driver - The active Chrome driver.
 * @returns {Promise<boolean>} Whether a drag state appeared during the swipe.
 */
async function swipeOperationUp(driver) {
    const start = await driver.executeScript(() => {
        const items = document.querySelectorAll("#operations .op-list li.operation");
        const item = [...items].find(el => {
            const rect = el.getBoundingClientRect();
            return rect.top > 170 && rect.bottom < innerHeight - 140 && rect.height >= 30;
        });
        if (!item) throw new Error("No visible operation to swipe");
        const rect = item.getBoundingClientRect();
        return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
    });

    const dragActive = () => driver.executeScript(() =>
        Boolean(document.querySelector(".sortable-chosen, .sortable-ghost, .sortable-drag")));
    let dragged = false;
    await driver.sendDevToolsCommand("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [start]
    });
    for (let step = 1; step <= 12; step++) {
        await driver.sendDevToolsCommand("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{x: start.x, y: start.y - step * 15}]
        });
        dragged ||= await dragActive();
    }
    await driver.sendDevToolsCommand("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: []
    });
    return dragged;
}

/**
 * Assert a pane is visible and the other work areas do not overlap it.
 * @param {WebDriver} driver - The active Chrome driver.
 * @param {string} panel - The selected panel.
 */
async function checkPanel(driver, panel) {
    const state = await driver.executeScript(() => {
        const names = ["operations", "recipe", "input", "output"];
        return Object.fromEntries(names.map(name => {
            const el = document.getElementById(name);
            return [name, el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== "none"];
        }));
    });
    for (const [name, visible] of Object.entries(state)) {
        assert.equal(visible, name === panel, `${name} visibility on ${panel} panel`);
    }
}

/**
 * Wait until a condition evaluated in the browser is true.
 * @param {WebDriver} driver - The active Chrome driver.
 * @param {Function} fn - A serializable browser-side predicate.
 * @param {number} timeout - Maximum wait in milliseconds.
 */
async function waitFor(driver, fn, timeout = 10000, ...args) {
    await driver.wait(() => driver.executeScript(fn, ...args), timeout);
}

/**
 * Optionally capture a screenshot to aid manual visual quality assurance.
 * @param {WebDriver} driver - The active Chrome driver.
 * @param {string} name - An identifying screenshot label.
 */
async function capture(driver, name) {
    if (!screenshotDirectory) return;
    fs.mkdirSync(screenshotDirectory, {recursive: true});
    fs.writeFileSync(path.join(screenshotDirectory, `${name}.png`),
        Buffer.from(await driver.takeScreenshot(), "base64"));
}

/** Run the responsive UI end-to-end in an actual browser. */
async function main() {
    const service = new chrome.ServiceBuilder(require("chromedriver").path);
    const driver = await new Builder()
        .forBrowser("chrome")
        .setChromeOptions(chromeOptions)
        .setChromeService(service)
        .build();

    try {
        await viewport(driver, 390, 844);
        await driver.get(baseURL);
        await waitFor(driver, () => !document.getElementById("loader-wrapper"), 60000);
        assert.equal(await driver.findElement(By.id("mobile-nav")).isDisplayed(), true);
        await checkPanel(driver, "input");
        await capture(driver, "390-input");
        console.log("PASS: 390px phone layout and initial editor");

        await driver.findElement(By.css('[data-mobile-panel="operations"]')).click();
        await checkPanel(driver, "operations");
        const initialScroll = await driver.executeScript(() => document.getElementById("operations").scrollTop);
        const draggedOnSwipe = await swipeOperationUp(driver);
        await waitFor(driver, before => document.getElementById("operations").scrollTop > before + 30, 5000, initialScroll);
        assert.equal(draggedOnSwipe, false, "A swipe must scroll rather than drag an operation");
        assert.equal((await driver.findElements(By.css("#rec-list > li.operation"))).length, 0,
            "Scrolling must not add an operation to the recipe");
        console.log("PASS: finger scrolling on operation rows without dragging");
        await driver.findElement(By.id("search")).sendKeys("To Base64");
        await driver.wait(until.elementLocated(By.css("#search-results li.operation")), 10000);
        await driver.executeScript(() => document.querySelector("#search-results li.operation").scrollIntoView({block: "center"}));
        await capture(driver, "390-operations");
        await tap(driver, "#search-results li.operation");
        await checkPanel(driver, "recipe");
        assert.equal(await driver.findElement(By.css("#rec-list .op-title")).getText(), "To Base64");
        assert.equal(await driver.findElement(By.css(".mobile-recipe-count")).getText(), "1");
        await capture(driver, "390-recipe");
        console.log("PASS: touch operation search and single-tap add");

        await driver.findElement(By.css('[data-mobile-panel="input"]')).click();
        await tap(driver, "#input-text .cm-content");
        await driver.findElement(By.css("#input-text .cm-content")).sendKeys("hello");
        await waitFor(driver, () => document.body.classList.contains("mobile-editing"));
        assert.equal(await driver.findElement(By.id("mobile-nav")).isDisplayed(), false);
        await driver.findElement(By.id("mobile-bake")).click();
        await checkPanel(driver, "output");
        await waitFor(driver, () => !document.body.classList.contains("mobile-editing"));
        await waitFor(driver, () => document.querySelector("#output-text .cm-content")?.textContent.trim() === "aGVsbG8=");
        await capture(driver, "390-output");
        console.log("PASS: input -> recipe -> bake -> output");

        await driver.findElement(By.css('[data-mobile-panel="recipe"]')).click();
        await driver.findElement(By.id("mobile-add-operation")).click();
        await checkPanel(driver, "operations");
        await driver.findElement(By.id("search")).clear();
        await driver.findElement(By.id("search")).sendKeys("From Base64");
        await driver.wait(until.elementLocated(By.css("#search-results li.operation")), 10000);
        await driver.executeScript(() => document.querySelector("#search-results li.operation").scrollIntoView({block: "center"}));
        await tap(driver, "#search-results li.operation");
        assert.equal((await driver.findElements(By.css("#rec-list > li.operation"))).length, 2);
        await tap(driver, "#rec-list > li:last-child .mobile-move-up");
        assert.equal(await driver.findElement(By.css("#rec-list > li:first-child .op-title")).getText(), "From Base64");
        await tap(driver, "#rec-list > li:first-child .mobile-remove-operation");
        assert.equal((await driver.findElements(By.css("#rec-list > li.operation"))).length, 1);
        console.log("PASS: tap-friendly recipe reordering and removal");

        for (const width of [320, 768, 1023]) {
            await viewport(driver, width, width === 320 ? 568 : 900);
            await driver.findElement(By.css('[data-mobile-panel="input"]')).click();
            await checkPanel(driver, "input");
            const dimensions = await driver.executeScript(() => ({
                width: window.innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                navHeight: document.getElementById("mobile-nav").getBoundingClientRect().height
            }));
            assert.equal(dimensions.width, width);
            assert.ok(dimensions.scrollWidth <= width, `No outer horizontal overflow at ${width}px`);
            assert.ok(dimensions.navHeight >= 60, `Visible navigation at ${width}px`);
            if (width === 320) await capture(driver, "320-input");
            console.log(`PASS: ${width}px responsive layout`);
        }

        await driver.findElement(By.id("mobile-menu-toggle")).click();
        assert.equal(await driver.findElement(By.id("mobile-menu")).isDisplayed(), true);
        await driver.findElement(By.css('#mobile-menu [data-original-click="options"]')).click();
        await driver.wait(until.elementIsVisible(await driver.findElement(By.id("options-modal"))), 10000);
        console.log("PASS: touch-accessible settings menu");

        await viewport(driver, 1280, 900);
        await waitFor(driver, () => getComputedStyle(document.getElementById("mobile-nav")).display === "none");
        assert.equal(await driver.findElement(By.id("operations")).isDisplayed(), true);
        assert.equal(await driver.findElement(By.id("recipe")).isDisplayed(), true);
        assert.equal(await driver.findElement(By.id("input")).isDisplayed(), true);
        console.log("PASS: original desktop layout remains available");
    } finally {
        await driver.quit();
    }
}

main().catch(error => {
    console.error("FAIL:", error.stack || error);
    process.exitCode = 1;
});
