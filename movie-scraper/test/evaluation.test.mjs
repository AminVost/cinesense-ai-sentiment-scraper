import test from "node:test";
import assert from "node:assert/strict";
import {score} from "../tools/evaluate-sentiment.mjs";

test("calculates independent accuracy and coverage correctly",()=>{
  const gold=[
    {id:"1",language:"en",label:"Positive"},
    {id:"2",language:"en",label:"Negative"},
    {id:"3",language:"en",label:"Neutral"},
    {id:"4",language:"fa",label:"Positive"},
  ];
  const predictions=[
    {id:"1",sentiment:"Positive"},
    {id:"2",sentiment:"Positive"},
    {id:"3",sentiment:"Unclassified"},
    {id:"4",sentiment:"Unclassified"},
  ];
  const r=score(gold,predictions);
  assert.equal(r.languages.en.total,3);
  assert.equal(r.languages.en.classifiable,2);
  assert.equal(r.languages.en.coverage,2/3);
  assert.equal(r.languages.en.accuracy,0.5);
  assert.equal(r.languages.en.meetsMinimumSample,false);
  assert.equal(r.languages.fa.coverage,0);
  assert.equal(r.languages.fa.accuracy,null);
});
test("missing predictions or missing human labels are rejected",()=>{
  assert.throws(()=>score([{id:"1",language:"fa",label:"Positive"}],[]));
  assert.throws(()=>score([{id:"1",language:"fa",label:"INVALID"}],[{id:"1",sentiment:"Positive"}]));
});
