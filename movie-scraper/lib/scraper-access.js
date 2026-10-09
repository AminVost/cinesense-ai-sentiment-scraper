import { timingSafeEqual } from "node:crypto";

export function scraperEnabled() {
  const token=process.env.CINESENSE_SCRAPER_ACCESS_CODE;
  return typeof token==="string" && token.length>=24;
}

export function isAuthorizedScrape(request) {
  if(!scraperEnabled()) return false;
  const expected=Buffer.from(process.env.CINESENSE_SCRAPER_ACCESS_CODE,"utf8");
  const candidate=Buffer.from(request.headers.get("x-cinesense-scraper-key")||"","utf8");
  const normalized=Buffer.alloc(expected.length);
  candidate.copy(normalized,0,0,normalized.length);
  return candidate.length===expected.length && timingSafeEqual(expected,normalized);
}
