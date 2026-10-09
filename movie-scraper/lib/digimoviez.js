/**
 * Movie-aware, bounded browser discovery and comment extraction.
 * No user-supplied URL is loaded. The canonical movie identity is obtained
 * from TMDB server-side before we search the allowlisted DigiMoviez host.
 */
import { ApiError, getSelectedMovie } from "./vercel-api.js";
import { rankDigiCandidate, chooseMatchingCandidate } from "./movie-discovery.js";

const DEFAULT_HOSTS = "digimoviez.com";
export function allowedHosts(){
  return (process.env.DIGIMOVIEZ_ALLOWED_HOSTS || DEFAULT_HOSTS).split(",")
    .map(x=>x.trim().toLowerCase()).filter(x=>/^[a-z0-9.-]+$/.test(x));
}
export function validateDigiMoviezUrl(value) {
  let url;
  try { url=new URL(value); } catch { throw new ApiError("Invalid DigiMoviez URL."); }
  if(url.protocol!=="https:"||url.port||url.username||url.password)
    throw new ApiError("Only standard HTTPS DigiMoviez URLs are allowed.");
  if(!allowedHosts().some(h=>url.hostname.toLowerCase()===h||url.hostname.toLowerCase()==="www."+h))
    throw new ApiError("DigiMoviez domain is not permitted.");
  return url.href;
}

function internalSearchUrl(query){
  const root="https://"+allowedHosts()[0]+"/";
  return root+"?s="+encodeURIComponent(query.slice(0,110));
}
async function openPage(page,url,timeout=22000){
  const response=await page.goto(validateDigiMoviezUrl(url),{waitUntil:"domcontentloaded",timeout});
  if(!response||response.status()>=400)
    throw new ApiError("DigiMoviez is temporarily unavailable (HTTP "+(response?.status()||"?")+").",502);
}
export async function discoverAndScrapeDigiMoviez(tmdbId,maxComments=10){
  if(!Number.isInteger(maxComments)||maxComments<1||maxComments>10)
    throw new ApiError("Select 1–10 DigiMoviez comments.");
  // A client can only choose a TMDB id. No arbitrary URL, host or port input.
  const movie=await getSelectedMovie(tmdbId);
  let browser,context;
  try{
    const [{chromium:playwright},chromiumPackage]=await Promise.all([
      import("playwright-core"),import("@sparticuz/chromium")
    ]);
    const chrome=chromiumPackage.default;
    browser=await playwright.launch({executablePath:await chrome.executablePath(),args:chrome.args,headless:true});
    context=await browser.newContext({serviceWorkers:"block",acceptDownloads:false,javaScriptEnabled:true});
    await context.route("**/*",route=>{
      let allowed=true;
      try{validateDigiMoviezUrl(route.request().url());}catch{allowed=false;}
      const blocked=["image","media","font","stylesheet","manifest","other"].includes(route.request().resourceType());
      return !allowed||blocked?route.abort("blockedbyclient"):route.continue();
    });
    await context.routeWebSocket("**/*",socket=>socket.close());
    const page=await context.newPage();
    page.setDefaultTimeout(9000);

    // Search only twice, and only using verified film titles. No outbound
    // website traffic is generated while a user types in the search box.
    let selection={status:"not_found",match:null,candidates:[]};
    const terms=[movie.title,...(movie.translated!==movie.title?[movie.translated]:[])].filter(Boolean).slice(0,2);
    for(const term of terms){
      await openPage(page,internalSearchUrl(term));
      const options=await page.locator(".title_h a[href]").evaluateAll(nodes=>nodes.slice(0,30)
        .map(a=>({id:a.href,title:(a.textContent||"").trim().slice(0,180),url:a.href})));
      // Search results can contain unrelated recommendations, series, and
      // site navigation. Only canonical single-movie pages are eligible.
      const safe=options.filter(x=>{
        try {
          const u=new URL(x.url);
          return /^\/[a-z0-9-]+\/$/i.test(u.pathname) && /(?:19|20)\d\d/.test(x.title) &&
            !/^\/serie\//.test(u.pathname);
        }catch{return false;}
      }).filter(x=>{try{validateDigiMoviezUrl(x.url);return true;}catch{return false;}});
      selection=chooseMatchingCandidate(safe,option=>rankDigiCandidate(movie,option),0.79,0.075);
      if(selection.match || selection.status==="ambiguous")break;
    }
    if(!selection.match)
      throw new ApiError(selection.status==="ambiguous"
        ?"Multiple DigiMoviez movies matched too closely; no film was selected to avoid mixing comments."
        :"The selected film was not reliably found on DigiMoviez.",404);

    const matched=selection.match;
    await openPage(page,matched.url);
    const texts=[],seen=new Set();
    for(let attempt=0;attempt<3;attempt++){
      const visible=await page.locator(".comment_text_toggle p").allTextContents();
      for(const raw of visible){
        const comment=String(raw||"").trim().slice(0,2000);
        if(comment&&!seen.has(comment)){seen.add(comment);texts.push(comment);}
        if(texts.length>=maxComments)break;
      }
      if(texts.length>=maxComments)break;
      const more=page.locator("#ajaxLoadMoreComments").first();
      if(!(await more.isVisible().catch(()=>false)))break;
      await more.click({timeout:5500});
      try{await page.waitForFunction(count=>document.querySelectorAll(".comment_text_toggle p").length>count,
        visible.length,{timeout:5500});}catch{break;}
    }
    if(!texts.length)throw new ApiError("DigiMoviez movie matched, but no public comments were found.",404);
    return {
      reviews:texts.slice(0,maxComments).map((text,index)=>({
        id:"digi-"+index,text,author:null,source:"digimoviez",sourceUrl:matched.url,
        reviewType:"film",rating:null,sentiment:"Unclassified",metric:"none",model:null,
      })),
      matchedSource:{url:matched.url,title:matched.title,confidence:Number(matched.match.score.toFixed(2))},
      hasMore:texts.length>=maxComments
    };
  }catch(error){
    if(error instanceof ApiError)throw error;
    console.error("[DigiMoviez discovery]",error?.name||"error",String(error?.message||"").slice(0,240));
    throw new ApiError("DigiMoviez search or comments are currently unavailable.",502);
  }finally{
    if(context)await context.close().catch(()=>{});
    if(browser)await browser.close().catch(()=>{});
  }
}
