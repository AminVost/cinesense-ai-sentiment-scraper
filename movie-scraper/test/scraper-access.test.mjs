import test from "node:test";
import assert from "node:assert/strict";
import {scraperEnabled,isAuthorizedScrape} from "../lib/scraper-access.js";

const old=process.env.CINESENSE_SCRAPER_ACCESS_CODE;
const passcode="0123456789abcdef0123456789abcdef01234567";
test.after(()=>{
  if(old===undefined)delete process.env.CINESENSE_SCRAPER_ACCESS_CODE;
  else process.env.CINESENSE_SCRAPER_ACCESS_CODE=old;
});
test("scraper disabled with missing or weak access code",()=>{
  delete process.env.CINESENSE_SCRAPER_ACCESS_CODE;
  assert.equal(scraperEnabled(),false);
  process.env.CINESENSE_SCRAPER_ACCESS_CODE="short";
  assert.equal(scraperEnabled(),false);
});
test("check secure owner authorization",()=>{
  process.env.CINESENSE_SCRAPER_ACCESS_CODE=passcode;
  const request=key=>({headers:new Headers(key?{"x-cinesense-scraper-key":key}:{})});
  assert.equal(scraperEnabled(),true);
  assert.equal(isAuthorizedScrape(request()),false);
  assert.equal(isAuthorizedScrape(request(passcode.slice(0,-1))),false);
  assert.equal(isAuthorizedScrape(request(passcode+"a")),false);
  assert.equal(isAuthorizedScrape(request("0".repeat(passcode.length))),false);
  assert.equal(isAuthorizedScrape(request(passcode)),true);
});
