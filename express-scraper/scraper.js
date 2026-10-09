const { chromium } = require("playwright");
const { analyzeComments } = require("./analyzeComments");
const logger = require("./logger");
const { validateMovieUrl } = require("./lib/validation");

let browserPromise = null;
let activeScrapes = 0;
const queue = [];
const MAX_CONCURRENT_SCRAPES = 2;
const MAX_PAGES = 25;

async function acquireSlot() {
  if (activeScrapes >= MAX_CONCURRENT_SCRAPES) {
    await new Promise(resolve => queue.push(resolve));
  }
  activeScrapes++;
  return () => {
    activeScrapes--;
    const waiting = queue.shift();
    if (waiting) waiting();
  };
}

async function getBrowserInstance() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true })
      .then(browser => {
        browser.on("disconnected", () => { browserPromise = null; });
        return browser;
      })
      .catch(error => {
        browserPromise = null;
        throw error;
      });
  }
  return browserPromise;
}

async function fetchComments(rawUrl, maxComments = 20) {
  const url = validateMovieUrl(rawUrl);
  const release = await acquireSlot();
  let context;
  try {
    const browser = await getBrowserInstance();
    context = await browser.newContext({
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    // Only allow explicitly configured scraper hosts for ALL browser requests.
    // This also blocks redirect-based SSRF, subresource requests to internal IPs,
    // and remote scripts hosted outside the allowlist.
    await page.route("**/*", route => {
      try {
        validateMovieUrl(route.request().url());
      } catch (_error) {
        return route.abort("blockedbyclient");
      }
      if (["image", "stylesheet", "font", "media"].includes(route.request().resourceType())) {
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });

    logger.info("Opening movie page: " + url);
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (!response || response.status() < 200 || response.status() >= 400) {
      return { error: "Movie page could not be opened." };
    }

    const seen = new Set();
    const allComments = [];
    let pages = 0;
    let hasMore = false;

    while (allComments.length < maxComments && pages < MAX_PAGES) {
      pages++;
      const comments = await page.locator(".comment_text_toggle p").allTextContents();
      let added = 0;
      for (const rawComment of comments) {
        const text = String(rawComment).trim();
        if (!text || seen.has(text)) continue;
        seen.add(text);
        allComments.push(text.slice(0, 12000));
        added++;
        if (allComments.length >= maxComments) break;
      }

      const button = page.locator("#ajaxLoadMoreComments").first();
      const available = await button.isVisible().catch(() => false);
      hasMore = available;
      if (allComments.length >= maxComments || !available) break;
      if (!added && pages > 1) break;

      const oldCount = comments.length;
      await button.click();
      try {
        await page.waitForFunction(
          previous => document.querySelectorAll(".comment_text_toggle p").length > previous,
          oldCount,
          { timeout: 12000 },
        );
      } catch (_error) {
        logger.warn("Load-more button did not return additional comments.");
        break;
      }
    }

    if (!allComments.length) {
      return { totalComments: 0, comments: [], hasMore: false };
    }
    logger.info("Analyzing " + allComments.length + " comments.");
    const analyzedComments = await analyzeComments(allComments);
    return { totalComments: analyzedComments.length, comments: analyzedComments, hasMore };
  } catch (error) {
    logger.error("Scraper failure: " + error.message);
    return { error: "Failed to extract or analyze comments. Please try again." };
  } finally {
    if (context) await context.close().catch(error => logger.warn("Context cleanup: " + error.message));
    release();
  }
}

module.exports = { fetchComments };
