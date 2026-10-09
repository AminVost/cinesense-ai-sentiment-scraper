// Evaluation only: needs independent HUMAN-labelled reference data.
// Usage: node tools/evaluate-sentiment.mjs human-gold.jsonl actual-predictions.jsonl
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const LABELS=["Positive","Negative","Neutral"];
export function score(gold,predictions){
  const predicted=new Map(predictions.map(item=>[String(item.id),item]));
  const byLanguage={};
  for(const row of gold){
    if(!row||!String(row.id||"")||!row.language||!LABELS.includes(row.label))throw Error("Invalid gold row (id, language, label required)");
    const key=String(row.language);
    const g=byLanguage[key]??=([]);
    const p=predicted.get(String(row.id));
    if(!p)throw Error("Missing model prediction for "+row.id);
    const label=LABELS.includes(p.sentiment)?p.sentiment:"Unclassified";
    g.push({truth:row.label,pred:label});
  }
  const output={};
  for(const [lang,rows] of Object.entries(byLanguage)){
    const used=rows.filter(r=>r.pred!=="Unclassified");
    const accuracy=used.length?used.filter(r=>r.truth===r.pred).length/used.length:null;
    const details=Object.fromEntries(LABELS.map(label=>{
      const tp=used.filter(r=>r.truth===label&&r.pred===label).length;
      const fp=used.filter(r=>r.truth!==label&&r.pred===label).length;
      const fn=used.filter(r=>r.truth===label&&r.pred!==label).length;
      const precision=tp+fp?tp/(tp+fp):0;
      const recall=tp+fn?tp/(tp+fn):0;
      const f1=precision+recall?2*precision*recall/(precision+recall):0;
      return [label,{precision,recall,f1,support:rows.filter(r=>r.truth===label).length}];
    }));
    output[lang]={total:rows.length,classifiable:used.length,coverage:used.length/rows.length,
      accuracy,macroF1:used.length?LABELS.reduce((sum,l)=>sum+details[l].f1,0)/LABELS.length:null,
      classes:details,
      meetsMinimumSample:rows.length>=100};
  }
  return {disclaimer:"Scores require human-labelled examples independent of training. Do not publish accuracy claims with small samples.",languages:output};
}
function readJSONL(path) {
  return fs.readFileSync(path,"utf8").split(/\r?\n/).filter(Boolean).map((row,index)=>{
    try{return JSON.parse(row)}catch{throw Error("Bad JSONL at line "+(index+1));}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw Error("Pass gold and actual model predictions JSONL paths.");
  console.log(JSON.stringify(score(readJSONL(process.argv[2]),readJSONL(process.argv[3])),null,2));
}
