/* Open-source AI inference in the visitor's browser: no AI API calls and no server GPU.
 * 168 MB quantized model is downloaded on FIRST use and cached by the browser.
 * Model supports English, German, French, Italian, Spanish and Dutch.
 * Persian and other unsupported languages must be left Unclassified.
 */
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1";
const MODEL = "Xenova/bert-base-multilingual-uncased-sentiment";
const SUPPORTED = ["en", "de", "fr", "es", "it", "nl"];
env.allowLocalModels = false;
let classifierPromise;
let persianClassifierPromise;

function language(text) {
  const persian = (text.match(/[\u0600-\u06ff]/g) || []).length;
  const letters = (text.match(/\p{L}/gu) || []).length;
  if (persian && persian / Math.max(1, letters) > .35) return "fa";
  // Without a validated language detection model we cannot safely classify
  // non-Latin scripts. Latin-script text is explicitly marked "unverified".
  if (/[^\x00-\x7f\u00c0-\u024f\u1e00-\u1eff]/u.test(text.replace(/[^\p{L}]/gu, ""))) return "unsupported";
  return "latin-unverified";
}

function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = pipeline("text-classification", MODEL, {
      dtype: "q8", device: "wasm",
      progress_callback: event => {
        if (event?.status === "progress" && Number.isFinite(event.progress)) {
          self.postMessage({ type: "download", percent: Math.round(event.progress), file: event.file || "model" });
        }
      }
    }).catch(error => {classifierPromise=null;throw error;});
  }
  return classifierPromise;
}

function persianScores(predictions, model) {
  const rows=Array.isArray(predictions?.[0])?predictions[0]:predictions;
  const scores={Positive:0,Negative:0};
  for(const row of rows||[]) {
    const label=String(row.label||"").toLowerCase();
    if(label==="positive")scores.Positive=Number(row.score)||0;
    if(label==="negative")scores.Negative=Number(row.score)||0;
  }
  const total=scores.Positive+scores.Negative;
  if(total<=0)throw Error("Unsupported Persian ONNX sentiment label mapping.");
  const positive=scores.Positive/total,negative=scores.Negative/total;
  return {sentiment:positive>=negative?"Positive":"Negative",
    positive,negative,neutral:0,model,language:"fa"};
}
function getPersianClassifier(model) {
  if(!persianClassifierPromise) {
    persianClassifierPromise=pipeline("text-classification",model,{
      dtype:"q8",device:"wasm",
      progress_callback:event=>{
        if(event?.status==="progress"&&Number.isFinite(event.progress))
          self.postMessage({type:"download",percent:Math.round(event.progress),file:event.file||"persian-model"});
      }
    }).catch(error=>{persianClassifierPromise=null;throw error;});
  }
  return persianClassifierPromise;
}

function fromStars(predictions) {
  const rows = Array.isArray(predictions?.[0]) ? predictions[0] : predictions;
  const stars = [0, 0, 0, 0, 0];
  for (const p of rows || []) {
    const n = Number.parseInt(p.label, 10);
    if (n>=1 && n<=5 && Number.isFinite(p.score)) stars[n-1] = p.score;
  }
  const sum=stars.reduce((a,b)=>a+b,0);
  if (sum<=0) throw Error("Model returned unrecognized star labels.");
  const negative=(stars[0]+stars[1])/sum;
  const neutral=stars[2]/sum;
  const positive=(stars[3]+stars[4])/sum;
  const ratings={Positive:positive,Neutral:neutral,Negative:negative};
  return {sentiment:Object.keys(ratings).reduce((a,b)=>ratings[a]>=ratings[b]?a:b),positive,neutral,negative,model:MODEL,language:"latin-unverified"};
}

self.addEventListener("message", async event => {
  const { id, comments, persianModelId } = event.data||{};
  if (!Number.isSafeInteger(id) || !Array.isArray(comments) || comments.length>90) return;
  const input=comments.map(item=>({key:String(item.key||""),text:String(item.text||"").trim()})).filter(x=>x.text&&x.key);
  try {
    const eligible=input.filter(item=>language(item.text)==="latin-unverified" || (language(item.text)==="fa" && persianModelId));
    if (!eligible.length) {
      self.postMessage({type:"complete",id,results:input.map(x=>({key:x.key,sentiment:"Unclassified",language:language(x.text),model:null}))});
      return;
    }
    const requiresLatin=eligible.some(item=>language(item.text)==="latin-unverified");
    const requiresPersian=eligible.some(item=>language(item.text)==="fa");
    const classifier=requiresLatin?await getClassifier():null;
    const persian=requiresPersian?await getPersianClassifier(persianModelId):null;
    const results=[];
    for(let i=0;i<input.length;i++){
      const item=input[i];const lng=language(item.text);
      if(lng==="fa" && persian){
        const out=await persian(item.text.slice(0,1800),{top_k:2,truncation:true});
        results.push({key:item.key,...persianScores(out,persianModelId)});
      }else if(lng!=="latin-unverified"){
        results.push({key:item.key,sentiment:"Unclassified",model:null,language:lng});
      }else{
        const out=await classifier(item.text.slice(0,1800),{top_k:5,truncation:true});
        results.push({key:item.key,...fromStars(out)});
      }
      self.postMessage({type:"progress",id,done:i+1,total:input.length});
    }
    self.postMessage({type:"complete",id,results});
  }catch(error){
    self.postMessage({type:"error",id,message:"Browser AI model could not load or complete analysis. "+String(error.message||"")});
  }
});
