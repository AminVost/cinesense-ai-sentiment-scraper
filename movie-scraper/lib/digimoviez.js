/**
 * Bounded on-demand Playwright extraction for a single allowlisted movie page.
 * Uses Chromium that can run inside Vercel Functions; NO anti-bot bypass.
 * Existing site selectors were taken from the original CineSense scraper.
 */
import { ApiError } from "./vercel-api.js";

const DEFAULT_HOSTS = "digimoviez44.top";
export function allowedHosts(){
  return (process.env.DIGIMOVIEZ_ALLOWED_HOSTS || DEFAULT_HOSTS).split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
}
export function validateDigiMoviezUrl(value){
  let url;
  try {url=new URL(value);}catch{throw new ApiError("Enter a valid DigiMoviez HTTPS URL.");}
  if(url.protocol!=="https:"||url.port||url.username||url.password)
    throw new ApiError("Scraper only accepts HTTPS URLs without custom ports or credentials.");
  const hostname=url.hostname.toLowerCase();
  if(!allowedHosts().some(h=>hostname===h || hostname==="www."+h))
    throw new ApiError("This movie site is not in the allowed host list.");
  return url.href;
}

export async function scrapeDigiMoviez(urlValue,maxComments=10){
  const url=validateDigiMoviezUrl(urlValue);
  if(!Number.isInteger(maxComments)||maxComments<1||maxComments>10)
    throw new ApiError("DigiMoviez supports 1–10 comments per request.");
  // Use imports only during an actual request so regular TMDB API routes stay small.
  let browser,context;
  try{
    const [{chromium:playwright},chromiumPackage]=await Promise.all([
      import("playwright-core"),import("@sparticuz/chromium")
    ]);
    const chrome=chromiumPackage.default;
    const executablePath=await chrome.executablePath();
    browser=await playwright.launch({
      executablePath,args:chrome.args,headless:true,
    });
    context=await browser.newContext({
      serviceWorkers:"block",acceptDownloads:false,
      javaScriptEnabled:true,
    });
    // Reject all off-domain requests, redirects, popup requests and websocket.
    await context.route("**/*",route=>{
      let allowed;
      try{validateDigiMoviezUrl(route.request().url());allowed=true;}catch{allowed=false;}
      if(!allowed||["image","media","font","stylesheet"].includes(route.request().resourceType()))
        return route.abort("blockedbyclient");
      return route.continue();
    });
    await context.routeWebSocket("**/*",socket=>socket.close());
    const page=await context.newPage();
    page.setDefaultTimeout(12000);
    const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:22000});
    if(!response||response.status()>=400) throw new ApiError("Movie site blocked or unavailable (HTTP "+(response?.status()||"no-response")+").",502);
    const texts=[],seen=new Set();
    for(let attempt=0;attempt<3;attempt++){
      const visible=await page.locator(".comment_text_toggle p").allTextContents();
      for(const raw of visible){
        const text=String(raw||"").trim().slice(0,2000);
        if(text&&!seen.has(text)){
          seen.add(text);
          texts.push(text);
        }
        if(texts.length>=maxComments)break;
      }
      if(texts.length>=maxComments)break;
      const button=page.locator("#ajaxLoadMoreComments").first();
      if(!(await button.isVisible().catch(()=>false))) break;
      await button.click({timeout:6000});
      try{
        await page.waitForFunction(previous=>document.querySelectorAll(".comment_text_toggle p").length>previous,
          visible.length,{timeout:6500});
      }catch{break;}
    }
    if(!texts.length)throw new ApiError("No comments found. DigiMoviez may have changed or restricted access.",502);
    return {reviews:texts.slice(0,maxComments).map((text,i)=>({
      id:"digi-"+i,text,author:null,source:"digimoviez",sourceUrl:url,
      reviewType:"film",rating:null,sentiment:"Unclassified",metric:"none",model:null,
    })),hasMore:texts.length>=maxComments};
  }catch(error){
    if(error instanceof ApiError)throw error;
    // Never expose paths or secret headers.
    console.error("[DigiMoviez]",error?.name||"Scraper error");
    throw new ApiError("DigiMoviez could not be reached or parsed from this server.",502);
  }finally{
    if(context)await context.close().catch(()=>{});
    if(browser)await browser.close().catch(()=>{});
  }
}
