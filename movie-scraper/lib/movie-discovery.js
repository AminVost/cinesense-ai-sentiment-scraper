/**
 * Deterministic, fail-closed movie/source matching. Never treat a vague
 * franchise mention or an unrelated fan trailer as a verified movie match.
 */
export function normalizeTitle(text) {
  return String(text || "").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/&amp;|&/gi," and ").replace(/&quot;/gi,' ')
    .replace(/[\p{P}\p{S}_]+/gu," ").replace(/\s+/g," ").trim().toLowerCase();
}
function movieWords(text) {
  return normalizeTitle(text).split(" ").filter(Boolean);
}
function stripTrailerTags(title){
  return normalizeTitle(title).replace(/\b(official|trailer|teaser|trailer\s*\d+|teaser\s*trailer|hd|4k|uhd|clip|movie|film|cinema|in\s*theaters|final|international|new|extended|theatrical|subbed|dubbed|english|release|premiere)\b/g," ")
    .replace(/\b(19\d\d|20\d\d|2100)\b/g," ").replace(/\s+/g," ").trim();
}
function dice(a,b) {
  const aa=new Set(movieWords(a)),bb=new Set(movieWords(b));
  if(!aa.size||!bb.size)return 0;
  let hits=0;for(const word of aa)if(bb.has(word))hits++;
  return (2*hits)/(aa.size+bb.size);
}
export function movieIdentity(movie) {
  const id=Number(movie?.id);
  const title=String(movie?.original_title||movie?.title||"").trim().slice(0,110);
  const translated=String(movie?.title||"").trim().slice(0,110);
  const year=Number(String(movie?.release_date||"").slice(0,4));
  if(!Number.isSafeInteger(id)||id<1||!title||title.length>110)
    throw Error("Selected movie metadata is invalid.");
  return {id,title,translated,year:year>=1900&&year<=2100?year:null};
}
export function rankYouTubeCandidate(movie,video) {
  const identity=movieIdentity(movie);
  const title=String(video?.title||"");
  const clean=stripTrailerTags(title).replace(/\b[1-9]\b/g," ").replace(/\s+/g," ").trim();
  const sim=Math.max(dice(identity.title,clean),dice(identity.translated,clean));
  const candidateYear=(title.match(/\b(19\d\d|20\d\d)\b/g)||[]).map(Number);
  if(identity.year&&candidateYear.length&&candidateYear.every(y=>Math.abs(y-identity.year)>1))
    return {score:0,reason:"year_conflict"};
  if(/\b(fan\s*made|fan\s*edit|concept|ai\s*generated|fake|unofficial|gameplay|parody|reaction|breakdown|review|ending\s*explained|red\s*band\s*reaction)\b/i.test(title))
    return {score:0,reason:"not_source_trailer"};
  if(!/\b(trailer|teaser)\b/i.test(title))
    return {score:0,reason:"not_trailer"};
  if(sim<0.78)return {score:sim,reason:"title_mismatch"};
  const channel=String(video?.channel||"");
  const known=/warner bros|sony pictures|universal pictures|paramount pictures|20th century studios|marvel entertainment|a24|netflix|disney|lionsgate|focus features|searchlight pictures|pixar|film4|apple tv|amazon mgm|legendary|neon|blumhouse/i.test(channel);
  const official=/\bofficial\b/i.test(title);
  let score=sim*0.78+(official?0.09:0)+(known?0.11:0)+(identity.year&&candidateYear.includes(identity.year)?0.03:0);
  const published=Number(String(video?.publishedAt||"").slice(0,4));
  if(identity.year&&published&&Math.abs(published-identity.year)>3)score-=0.18;
  if(!official&&!known)score-=0.06;
  return {score:Math.max(0,Math.min(1,score)),reason:"candidate",sim,official,known};
}
export function rankDigiCandidate(movie,entry) {
  const identity=movieIdentity(movie),title=String(entry?.title||"");
  const normal=normalizeTitle(title).replace(/^(?:دانلود\s+)?(?:فیلم|سریال|انیمیشن)\s+/u,"").replace(/\b(?:19|20)\d\d\b/g," ").replace(/\s+/g," ").trim();
  if(!title)return {score:0,reason:"empty"};
  const score=Math.max(dice(identity.title,normal),dice(identity.translated,normal));
  const candidateYears=(title.match(/\b(?:19|20)\d\d\b/g)||[]).map(Number);
  if(identity.year&&candidateYears.length&&!candidateYears.some(y=>Math.abs(y-identity.year)<=1))
    return {score:0,reason:"year_conflict"};
  return {score:Math.min(1,score+(identity.year&&candidateYears.includes(identity.year)?0.12:0)),reason:"candidate"};
}
export function chooseMatchingCandidate(items,ranker,threshold=0.77,ambiguityGap=0.10){
  const ranked=items.map(item=>({...item,match:ranker(item)})).sort((a,b)=>b.match.score-a.match.score);
  if(!ranked.length||ranked[0].match.score<threshold)
    return {status:"not_found",match:null,candidates:ranked.slice(0,3)};
  if(ranked.length>1&&ranked[0].match.score-ranked[1].match.score<ambiguityGap &&
    ranked[0].id!==ranked[1].id)
    return {status:"ambiguous",match:null,candidates:ranked.slice(0,3)};
  return {status:"matched",match:ranked[0],candidates:ranked.slice(0,3)};
}
