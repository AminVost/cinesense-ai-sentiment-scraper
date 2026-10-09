import test from "node:test";
import assert from "node:assert/strict";
import {rankYouTubeCandidate,rankDigiCandidate,chooseMatchingCandidate,movieIdentity} from "../lib/movie-discovery.js";

const film={id:157336,title:"Interstellar",original_title:"Interstellar",release_date:"2014-11-05"};
const candidate=(title,channel="Warner Bros. Pictures")=>({id:"zSWdZVtXT7E",title,channel,publishedAt:"2014-10-04T00:00:00Z"});

test("exact official trailer is selected from noisy YouTube search results",()=>{
  const samples=[
    candidate("Interstellar Official Trailer (2014)"),
    {id:"notreal0000",title:"Interstellar (2026) | AI Fan Made Concept Trailer",channel:"Random",publishedAt:"2026-09-01"},
    {id:"irrelevant01",title:"Interstellar Music Reaction Video",channel:"Review",publishedAt:"2014-10-04"}
  ];
  const result=chooseMatchingCandidate(samples,x=>rankYouTubeCandidate(film,x),0.76,0);
  assert.equal(result.match.id,"zSWdZVtXT7E");
  assert.equal(rankYouTubeCandidate(film,candidate("Interstellar 2 (2026) Fake Official Trailer")).score,0);
});
test("DigiMoviez Persian index label and year are matched; wrong remakes rejected",()=>{
  const right={id:"https://digimoviez.com/interstellar-2014/",title:"دانلود فیلم Interstellar 2014"};
  const wrong={id:"https://digimoviez.com/interstellar-2026/",title:"دانلود فیلم Interstellar 2026"};
  assert.ok(rankDigiCandidate(film,right).score>=1);
  assert.equal(rankDigiCandidate(film,wrong).score,0);
  assert.equal(chooseMatchingCandidate([wrong,right],x=>rankDigiCandidate(film,x),0.79,0.07).match.url,undefined);
  assert.equal(chooseMatchingCandidate([wrong,right],x=>rankDigiCandidate(film,x),0.79,0.07).match.id,right.id);
});
test("ambiguous matches never silently choose different movie pages",()=>{
  const options=[
    {id:"first",title:"دانلود فیلم Interstellar 2014"},
    {id:"second",title:"دانلود فیلم Interstellar 2014"}
  ];
  assert.equal(chooseMatchingCandidate(options,x=>rankDigiCandidate(film,x),0.79,0.075).status,"ambiguous");
});
test("invalid movie identities are rejected",()=>{
  assert.throws(()=>movieIdentity({id:0,title:"film"}));
  assert.throws(()=>movieIdentity({id:1,title:""}));
});
