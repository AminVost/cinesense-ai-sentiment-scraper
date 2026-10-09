const { chromium } = require("playwright");
const { analyzeComments } = require("./analyzeComments");
const logger = require("./logger");
const { validateMovieUrl } = require("./lib/validation");

// Global browser instance to avoid the 3-second cold start overhead per request
let globalBrowser = null;

async function getBrowserInstance() {
  if (!globalBrowser) {
    logger.info("Initializing global Playwright browser instance...");
    globalBrowser = await chromium.launch({ headless: true });
  }
  return globalBrowser;
}

function logMemoryUsage(tag) {
  const mem = process.memoryUsage();
  const rss = Math.round(mem.rss / 1024 / 1024);
  logger.info(`[RAM - ${tag}] Node Process: ${rss} MB`);
}

async function fetchComments(url, maxComments = 20) {
  let context;
  let page;
  let allComments = [];

  try {
    logMemoryUsage("Start");
    
    // Reuse the global browser and open an isolated context (like a new incognito tab)
    const browser = await getBrowserInstance();
    context = await browser.newContext();
    page = await context.newPage();

    // Block heavy resources to drastically improve page loading time
    await page.route('**/*', (route) => {
      const blockedResources = ['image', 'stylesheet', 'font', 'media'];
      if (blockedResources.includes(route.request().resourceType())) {
        route.abort(); 
      } else {
        route.continue(); 
      }
    });

    logger.info(`Navigating to URL: ${url}`);
    await page.route("**/*", async (route) => {
      if (route.request().isNavigationRequest()) {
        try { validateMovieUrl(route.request().url()); }
        catch (_) { return route.abort(); }
      }
      return route.fallback();
    });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    logMemoryUsage("After Page Load");

    if (!response || response.status() !== 200) {
      logger.error(`Page failed to load. Status: ${response ? response.status() : "No Response"}`);
      return { error: "Invalid URL or page not found. Please check the link." };
    }

    if (!Number.isInteger(maxComments) || maxComments <= 0) {
      maxComments = 20;
    }

    logger.info(`Extracting up to ${maxComments} comments...`);

    while (allComments.length < maxComments) {  
      const comments = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".comment_text_toggle p")).map(el => el.innerText.trim());
      });

      if (!comments.length && allComments.length === 0) {
        logger.warn("No comments found on the page.");
        return { totalComments: 0, comments: [], hasMore: false };
      }

      const newComments = comments.filter(comment => !allComments.includes(comment));
      allComments.push(...newComments);
      logger.info(`Extracted ${newComments.length} new comments. Total: ${allComments.length}`);

      if (allComments.length >= maxComments) {
        allComments = allComments.slice(0, maxComments);
        break;
      }

      const nextButton = await page.$("#ajaxLoadMoreComments");
      if (nextButton) {
        const isVisible = await nextButton.isVisible();
        if (!isVisible) break;

        logger.info('Clicking "Load More" button...');
        const previousCount = comments.length;
        await nextButton.click();
        
        try {
          await page.waitForFunction(
            (prev) => document.querySelectorAll(".comment_text_toggle p").length > prev,
            previousCount,
            { timeout: 15000 } 
          );
        } catch (error) {
          logger.warn('Server is too slow or no new comments loaded. Stopping scraper...');
          break; 
        }
      } else {
        break;
      }
    }

    if (allComments.length === 0) {
      return { error: "No comments available to analyze." };
    }

    logger.info(`Sending ${allComments.length} comments to AI model for parallel sentiment analysis...`);
    const analyzedComments = await analyzeComments(allComments);
    logger.info("Sentiment analysis completed!");

    logMemoryUsage("End");

    return {
      totalComments: analyzedComments.length,
      comments: analyzedComments,
      hasMore: allComments.length === maxComments,
    };
  } catch (error) {
    logger.error(`Error during comment extraction: ${error.message}`);
    return { error: "Failed to extract comments. Please try again later." };
  } finally {
    // Only close the isolated context, keep the main global browser running for the next request
    if (context) {
      await context.close();
      logger.info("Context closed. Global browser remains active.");
    }
  }
}

module.exports = { fetchComments };