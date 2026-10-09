"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import "./cinesense-frame-room.css";

const LABELS = { tmdb: "TMDB", youtube: "YouTube (تریلر)", digimoviez: "DigiMoviez (آزمایشی)" };
const LABEL_FA = {Positive:"مثبت",Negative:"منفی",Neutral:"خنثی",Unclassified:"نامشخص"};
const SOURCES = [{id:"tmdb",name:"TMDB",desc:"نقدهای فیلم",tone:"#b7c69f",icon:"film"},{id:"youtube",name:"YouTube",desc:"واکنش‌های تریلر",tone:"#ed8c7a",icon:"play"},{id:"digimoviez",name:"DigiMoviez",desc:"نظرات فارسی",tone:"#ed6748",icon:"chat"}];
const poster = movie => /^\/[\w.-]+\.(jpg|png|webp)$/i.test(movie?.poster_path || "") ? "https://image.tmdb.org/t/p/w185" + movie.poster_path : null;
function Icon({name,size=18}){
  const paths={
    film:"M4 3h16v18H4zM4 8h4m-4 8h4m8-8h4m-4 8h4M10 7l6 5-6 5",
    play:"M8 5v14l11-7z",chat:"M4 5h16v13H9l-5 4V5Zm4 5h8m-8 4h5",
    search:"M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm5.5-2.5L22 22",
    spark:"m12 2 1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8L12 2Z",
    check:"m5 12 4 4L19 6",arrow:"M7 17 17 7m-9 0h9v9",
    shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-4-10 3 3 5-6",
    bolt:"m13 2-9 12h7l-1 8 10-13h-7V2Z",
    graph:"M4 20V12m5 8V7m5 13V10m5 10V4",
    globe:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20",
    sliders:"M4 7h16M4 17h16M9 4v6m6 4v6",
    down:"m6 9 6 6 6-6",eye:"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    info:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 11v6m0-10v.5"
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.spark}/></svg>;
}
function Poster({movie}){
  const src=poster(movie);
  return src?<img className="cs-poster" width="47" height="67" loading="lazy" src={src} alt={"پوستر "+movie.title}/>:
    <span className="cs-poster" style={{display:"grid",placeItems:"center"}}><Icon name="film"/></span>;
}

const keyFor = (source, comment) => source + ":" + comment.id;

async function postJson(path,body,scraperCode){
  const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json",...(scraperCode?{"x-cinesense-scraper-key":scraperCode}:{})},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||"خطا در ارتباط با سرور");
  return data;
}
function metric(items,field="sentiment"){
  const counts={Positive:0,Negative:0,Neutral:0,Unclassified:0};
  items.forEach(item=>counts[item?.[field]]===undefined?counts.Unclassified++:counts[item[field]]++);
  const classified=counts.Positive+counts.Negative+counts.Neutral;
  return {...counts,total:items.length,classified,positivePercent:classified?Math.round(counts.Positive*100/classified):null};
}
function reviewAIStats(result,ai){
  if(!result)return null;
  const films=result.sources.filter(group=>group.category==="film")
    .flatMap(group=>group.comments.map(comment=>ai[keyFor(group.source,comment)]||{sentiment:"Unclassified"}));
  return metric(films);
}
export default function MultiSourcePage(){
  const [query,setQuery]=useState("");
  const [movies,setMovies]=useState([]);
  const [selectedMovie,setSelectedMovie]=useState(null);
  const [sources,setSources]=useState(["tmdb"]);
  const [scraperKey,setScraperKey]=useState("");
  const [maxComments,setMaxComments]=useState(10);
  const [secretVisible,setSecretVisible]=useState(false);
  const [view,setView]=useState("studio");
  const [activeSource,setActiveSource]=useState("all");
  const [activeSentiment,setActiveSentiment]=useState("all");
  const [commentKeyword,setCommentKeyword]=useState("");
  const [pageSize,setPageSize]=useState(8);
  const [expanded,setExpanded]=useState({});
  const [aiComplete,setAiComplete]=useState(false);
  const [searchBusy,setSearchBusy]=useState(false);
  const [providers,setProviders]=useState(null);
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [aiResults,setAiResults]=useState({});
  const [aiBusy,setAiBusy]=useState(false);
  const [aiError,setAiError]=useState("");
  const [aiProgress,setAiProgress]=useState("");
  const workerRef=useRef(null);
  const runId=useRef(0);
  useEffect(()=>{
    fetch("/api/providers").then(async response=>{
      if(!response.ok)throw Error("Cannot load providers");
      return response.json();
    }).then(data=>{
      setProviders(data);
      setSources(data.tmdb?.enabled?["tmdb"]:[]);
    }).catch(()=>setError("ارتباط با API برقرار نشد."));
    return ()=>workerRef.current?.terminate();
  },[]);
  useEffect(()=>{
    if(query.trim().length<2||!providers?.tmdb?.enabled){setMovies([]);setSearchBusy(false);return;}
    const controller=new AbortController();
    setSearchBusy(true);
    const timer=setTimeout(async()=>{
      try{
        const response=await fetch("/api/search-movie",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({query}),signal:controller.signal});
        const data=await response.json();
        if(!response.ok)throw Error(data.error||"جست‌وجوی فیلم ناموفق بود.");
        setMovies(data.results||[]);
      }catch(e){if(e.name!=="AbortError")setError(e.message);}
      finally{if(!controller.signal.aborted)setSearchBusy(false);}
    },450);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[query,providers]);
  function resetAnalysis(){
    workerRef.current?.terminate();workerRef.current=null;runId.current++;
    setAiBusy(false);setAiError("");setAiProgress("");setAiResults({});setAiComplete(false);
  }
  function toggle(source,checked){
    setSources(prev=>checked?[...prev,source]:prev.filter(s=>s!==source));
    setResult(null);resetAnalysis();setView("studio");
  }
  async function submit(){
    setError("");setResult(null);resetAnalysis();setLoading(true);
    try{
      const ordinary=sources.filter(s=>s!=="digimoviez");
      const requests=[];
      if(ordinary.length){
        requests.push(postJson("/api/analyze-movie",{
          sources:ordinary,tmdbId:selectedMovie?.id,maxComments:Number(maxComments)
        },scraperKey).then(data=>({type:"ordinary",data})));
      }
      if(sources.includes("digimoviez")){
        requests.push(postJson("/api/fetch-comments",{
          tmdbId:selectedMovie?.id,maxComments:Math.min(10,Number(maxComments))
        },scraperKey).then(data=>({type:"digimoviez",data})));
      }
      const settled=await Promise.allSettled(requests);
      const groups=[],errors=[];
      let originalSummary=null,trailerSummary=null;
      settled.forEach((entry,index)=>{
        const name=index===0&&ordinary.length?"ordinary":"digimoviez";
        if(entry.status==="rejected"){
          errors.push({source:name,error:entry.reason?.message||"منبع در دسترس نیست"});
          return;
        }
        const {type,data}=entry.value;
        if(type==="ordinary"){
          groups.push(...(data.sources||[]));errors.push(...(data.errors||[]));
          originalSummary=data.summary;trailerSummary=data.trailerSummary;
        }else{
          const comments=data.comments||[];
          groups.push({source:"digimoviez",category:"film",comments,hasMore:data.hasMore,matchedSource:data.matchedSource,
            summary:metric(comments)});
        }
      });
      if(!groups.length&&errors.length)throw Error(errors.map(e=>e.error).join(" / "));
      setResult({
        sources:groups,errors,
        summary:originalSummary||{total:0,rated:0,positivePercent:null,averageRating:null},
        trailerSummary:trailerSummary||{total:0,positivePercent:null}
      });
      setActiveSource("all");setActiveSentiment("all");setCommentKeyword("");setPageSize(8);setView("report");
    }catch(e){setError(e.message);}
    finally{setLoading(false);}
  }

  function startLocalAI(){
    if(!result||aiBusy)return;
    resetAnalysis();
    const id=runId.current;
    const comments=result.sources.flatMap(g=>g.comments.map(c=>({key:keyFor(g.source,c),text:c.text})));
    if(!comments.length){setAiError("نظری برای تحلیل موجود نیست.");return;}
    if(!window.Worker){setAiError("مرورگر شما از Web Worker پشتیبانی نمی‌کند.");return;}
    const worker=new Worker("/sentiment.worker.js",{type:"module"});
    workerRef.current=worker;setAiBusy(true);
    setAiProgress("در حال بارگیری مدل هوش مصنوعی روی مرورگر...");
    worker.onmessage=event=>{
      if(id!==runId.current)return;
      const data=event.data;
      if(data.type==="download")setAiProgress("دانلود مدل: "+data.percent+"٪");
      if(data.type==="progress")setAiProgress("در حال تحلیل: "+data.done+" از "+data.total);
      if(data.type==="error"){
        setAiBusy(false);setAiError(data.message||"مدل هوش مصنوعی اجرا نشد.");
        worker.terminate();workerRef.current=null;
      }
      if(data.type==="complete"){
        const next=Object.fromEntries(data.results.map(item=>[item.key,item]));
        setAiResults(next);setAiBusy(false);setAiComplete(true);
        setAiProgress("تحلیل مرورگری کامل شد.");
        worker.terminate();workerRef.current=null;
      }
    };
    worker.onerror=()=>{
      if(id!==runId.current)return;
      setAiBusy(false);
      setAiError("اجرای مدل روی مرورگر ممکن نشد؛ دسترسی به Hugging Face و CDN را بررسی کن.");
      worker.terminate();workerRef.current=null;
    };
    worker.postMessage({id,comments,persianModelId:providers?.persianModel?.model||null});
  }

  const stats=reviewAIStats(result,aiResults);
  const score=summary=>summary?.positivePercent==null?"داده کافی وجود ندارد":summary.positivePercent+"٪";
  const disabled=loading||!sources.length||!selectedMovie||sources.some(s=>!providers?.[s]?.enabled)
    ||((sources.includes("youtube")||sources.includes("digimoviez"))&&!scraperKey.trim())
    ||Number(maxComments)<1||Number(maxComments)>30;
  const filmCount=result?.sources.filter(g=>g.category==="film").reduce((n,g)=>n+g.comments.length,0)||0;
  const totalCount=result?.sources.reduce((n,g)=>n+g.comments.length,0)||0;
  const totalTrailer=result?.sources.filter(g=>g.category==="trailer").reduce((n,g)=>n+g.comments.length,0)||0;
  const displayed=useMemo(()=>result?.sources.flatMap(g=>g.comments.map(c=>({group:g,comment:c,ai:aiResults[keyFor(g.source,c)]})))||[],[result,aiResults]);
  const visible=displayed.filter(item=>(activeSource==="all"||item.group.source===activeSource) &&
    (activeSentiment==="all"||(item.ai?.sentiment||"Unclassified")===activeSentiment) &&
    (!commentKeyword.trim()||String(item.comment.text+" "+(item.comment.author||"")).toLocaleLowerCase().includes(commentKeyword.trim().toLocaleLowerCase())));
  const segments=[{id:"Positive",color:"#b7c69f",name:"مثبت"},{id:"Neutral",color:"#ebc986",name:"خنثی"},
    {id:"Negative",color:"#ed8c7a",name:"منفی"},{id:"Unclassified",color:"#555b78",name:"تحلیل‌نشده"}];
  const filmValues=segments.map(seg=>({...seg,count:result?.sources.filter(g=>g.category==="film").flatMap(g=>g.comments)
    .filter(c=>(aiResults[keyFor(c.source,c)]?.sentiment||"Unclassified")===seg.id).length||0}));
  const classified=stats?.classified||0;
  const pct=(count,total)=>total?Math.round(100*count/total):0;
  const pos=filmValues[0].count,neu=filmValues[1].count,neg=filmValues[2].count;
  const gradient=filmCount? "conic-gradient(#b7c69f 0 "+pct(pos,filmCount)+"%,#ebc986 "+pct(pos,filmCount)+"% "+pct(pos+neu,filmCount)+"%,#ed8c7a "+pct(pos+neu,filmCount)+"% "+pct(pos+neu+neg,filmCount)+"%,#555b78 "+pct(pos+neu+neg,filmCount)+"% 100%)":"#555b78";
  const protectedSelected=sources.includes("youtube")||sources.includes("digimoviez");

  // Frame Room v3 application UI rendered below.
}
