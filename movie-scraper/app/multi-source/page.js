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

  return <main className="cr-shell" dir="rtl">
    <aside className="cr-rail" aria-label="نوار ابزار CineSense">
      <a href="/" className="cr-mark" aria-label="CineSense">C<span style={{color:"#ed6748"}}>/</span>S</a>
      <div className="cr-rail-links">
        {[
          ["studio","search","جست‌وجوی فیلم"],
          ["report","graph","گزارش فیلم"],
          ["reviews","chat","نظرات"]
        ].map(item=><button key={item[0]} type="button" className="cr-nav"
          aria-label={item[2]} title={item[2]} aria-current={view===item[0]?"page":undefined}
          data-current={view===item[0]} disabled={item[0]!=="studio"&&!result}
          onClick={()=>setView(item[0])}><Icon name={item[1]} size={21}/></button>)}
      </div>
      <span className="cr-rail-bottom">FRAME ROOM / CINESENSE</span>
    </aside>

    <div className="cr-page">
      <header className="cr-top">
        <div className="cr-brand">CineSense <small>اتاق تحلیل فیلم</small></div>
        <div className="cr-top-end">
          <span className="cr-top-code">FRAME / 001</span>
          <span className="cr-online"><i/> موتور تحلیل آماده</span>
        </div>
      </header>
      <div className="cr-main">
        <div className="cr-headline">
          <div>
            <div className="cr-overline">{view==="studio"?"01 / DISCOVER":view==="report"?"02 / DECODE":"03 / REVIEWS"}</div>
            <h1 className="cr-title">{view==="studio"?"انتخاب فیلم":view==="report"?"تحلیل نظرات":"آرشیو نظرات"}</h1>
          </div>
          <span className="cr-breadcrumb">CINESENSE / {view.toUpperCase()}</span>
        </div>

        {view==="studio"&&<section className="cr-workarea" aria-label="انتخاب فیلم و منابع">
          <div className="cr-console">
            <div className="cr-console-top">
              <span className="cr-console-code">NEW SESSION / 01</span>
              <span className="cr-light-pair"><i/><i/><i/></span>
            </div>
            <div className="cr-console-inner">
              <label className="cr-fieldlabel" htmlFor="cr-movie">
                <span>جست‌وجوی فیلم</span><small>عنوان فیلم</small>
              </label>
              <Autocomplete id="cr-movie" className="cr-search" options={movies} value={selectedMovie}
                inputValue={query} loading={searchBusy}
                disabled={!providers?.tmdb?.enabled||loading}
                filterOptions={a=>a}
                isOptionEqualToValue={(a,b)=>a.id===b.id}
                getOptionLabel={movie=>typeof movie==="string"?movie:
                  movie.title+(movie.release_date?" ("+movie.release_date.slice(0,4)+")":"")}
                onChange={(_e,v)=>{setSelectedMovie(v);setResult(null);resetAnalysis();}}
                onInputChange={(_e,v,reason)=>{setQuery(v);if(reason==="input"||reason==="clear"){setSelectedMovie(null);setResult(null);resetAnalysis();}}}
                noOptionsText={query.trim().length<2?"حداقل دو حرف بنویس":"فیلمی پیدا نشد"}
                loadingText="در حال جست‌وجو..."
                slotProps={{paper:{sx:{
                  background:"#24261f",color:"#eae7dd",border:"1px solid #5b594a",borderRadius:0,
                  "& .MuiAutocomplete-option.Mui-focused":{background:"#38382f!important"},
                  "& .MuiAutocomplete-option[aria-selected=true]":{background:"#403429!important"}
                }}}}
                renderOption={(props,movie)=>{
                  const {key,...rest}=props;
                  return <li key={key} {...rest} style={{display:"flex",gap:10,alignItems:"center",direction:"rtl",padding:8}}>
                    {poster(movie)?<img src={poster(movie)} alt="" width={35} height={51} style={{objectFit:"cover"}}/>:
                      <span style={{width:35,height:51,background:"#383a33",display:"grid",placeItems:"center"}}><Icon name="film"/></span>}
                    <span><strong style={{fontSize:12}}>{movie.title}</strong>
                      <span style={{display:"block",fontSize:10,color:"#ada99d"}}>{movie.release_date?.slice(0,4)||"—"}</span></span>
                  </li>;
                }}
                renderInput={params=><TextField {...params} placeholder="Interstellar, Oppenheimer ..."
                  inputProps={{...params.inputProps,"aria-label":"عنوان فیلم"}}/>}
              />

              <div className="cr-choice-block">
                <div className="cr-fieldlabel">
                  <span>منابع</span><small>{sources.length} منبع</small>
                </div>
                <div className="cr-source-list" role="group" aria-label="انتخاب منبع نظرات">
                  {SOURCES.map((source,index)=><button key={source.id} type="button" className="cr-source"
                    data-on={sources.includes(source.id)} aria-pressed={sources.includes(source.id)}
                    disabled={!providers?.[source.id]?.enabled||loading}
                    onClick={()=>toggle(source.id,!sources.includes(source.id))}>
                    <span className="cr-source-ident">
                      <span className="cr-source-num">0{index+1}</span>
                      <span className="cr-source-name">{source.name}</span>
                    </span>
                    <span className="cr-source-switch">{sources.includes(source.id)&&<Icon name="check" size={12}/>}</span>
                  </button>)}
                </div>
              </div>

              <details className="cr-access">
                <summary><span style={{display:"flex",gap:8,alignItems:"center"}}><Icon name="sliders" size={15}/> تنظیمات</span>
                  <Icon name="down" size={15}/></summary>
                <div className="cr-access-grid">
                  <div>
                    <label htmlFor="cr-limit">تعداد نظر</label>
                    <select className="cr-textfield" id="cr-limit" value={maxComments}
                      disabled={loading} onChange={e=>setMaxComments(Number(e.target.value))}>
                      {[5,10,20,30].map(n=><option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cr-access-key">کد دسترسی منابع محافظت‌شده</label>
                    <div className="cr-inline-eye">
                      <input id="cr-access-key" className="cr-textfield" type={secretVisible?"text":"password"}
                        autoComplete="off" value={scraperKey}
                        onChange={e=>setScraperKey(e.target.value)} placeholder="کد خصوصی CineSense"/>
                      <button className="cr-quiet-button" type="button" title={secretVisible?"پنهان‌کردن":"نمایش"}
                        aria-label={secretVisible?"پنهان‌کردن کد":"نمایش کد"}
                        onClick={()=>setSecretVisible(!secretVisible)}><Icon name="eye" size={16}/></button>
                    </div>
                  </div>
                </div>
              </details>
              {protectedSelected&&!scraperKey.trim()&&<div className="cr-access-note">برای YouTube و DigiMoviez کد خصوصی را در تنظیمات وارد کن.</div>}
              {error&&<div className="cr-status" data-danger="true" role="alert"><Icon name="info" size={16}/>{error}</div>}
              <div className="cr-rule"/>
              <div className="cr-actions">
                <button type="button" className="cr-primary" disabled={disabled} onClick={submit}>
                  <Icon name="search" size={17}/>{loading?"در حال دریافت...":"شروع بررسی"}<Icon name="arrow" size={14}/>
                </button>
                <span className="cr-action-note">فقط نام فیلم کافی‌ست.</span>
              </div>
              {loading&&<div className="cr-working" role="status"><i className="cr-spinner"/> تطبیق منابع و دریافت نظرات...</div>}
            </div>
          </div>
          <aside className="cr-side" aria-label="فیلم انتخاب‌شده">
            <div className="cr-film-window">
              <div className="cr-film-frame">
                {poster(selectedMovie)?<img src={poster(selectedMovie)} alt={"پوستر "+selectedMovie.title}/>:
                  <div className="cr-frame-empty"><span className="cr-glyph">C/S</span><span className="cr-cross">+</span></div>}
              </div>
              <div className="cr-film-info">
                <div className="cr-small-id">SELECTED FRAME</div>
                <div className="cr-film-title">{selectedMovie?.title||"بدون فیلم"}</div>
                <div className="cr-film-sub">{selectedMovie?.release_date?.slice(0,4)||"—"} / MOVIE</div>
              </div>
            </div>
            <div className="cr-side-foot"><Icon name="shield" size={14}/> تحلیل متن روی دستگاه شما</div>
            <div className="cr-progress-rail">01 <span data-on={true}/> 02 <span/> 03</div>
          </aside>
        </section>}

        {result&&view!=="studio"&&<>
          <nav className="cr-page-nav" aria-label="بخش‌های تحلیل">
            {[
              ["studio","فیلم"],["report","گزارش"],["reviews","نظرات"]
            ].map(([id,label])=><button key={id} type="button" className="cr-tab" data-active={view===id}
              aria-current={view===id?"page":undefined} onClick={()=>setView(id)}>{label}
              {id==="reviews"&&<span className="cr-tabsuffix">{totalCount}</span>}
            </button>)}
          </nav>
          {result.errors.length>0&&<div className="cr-top-alerts">{result.errors.map((e,i)=>
            <div role="status" className="cr-status" key={i}><Icon name="info" size={15}/>{LABELS[e.source]||e.source}: {e.error}</div>)}</div>}
        </>}

        {view==="report"&&result&&<>
          <div className="cr-metric-strip">
            {[
              ["کل نظرات",totalCount,false],
              ["نقد فیلم",filmCount,false],
              ["واکنش تریلر",totalTrailer,false],
              ["AI مثبت",aiComplete&&stats?.positivePercent!=null?stats.positivePercent+"٪":"—",true]
            ].map(([label,value,accent])=><div className="cr-metric" key={label}>
              <label>{label}</label><strong data-accent={accent}>{value}</strong>
            </div>)}
          </div>
          <div className="cr-report-grid">
            <section className="cr-ledger" aria-label="شاخص احساسات فیلم">
              <div className="cr-ledger-top"><h3>شاخص احساسات فیلم</h3><span>SENTIMENT / FILM</span></div>
              <div className="cr-ledger-body">
                {aiComplete&&filmCount>0?<div className="cr-matrix">
                  {filmValues.map(item=><div className="cr-matrix-cell" key={item.id}>
                    <strong>{item.count}</strong>
                    <div className="cr-matrix-track"><div className="cr-matrix-fill"
                      style={{height:Math.max(2,pct(item.count,filmCount))+"%",background:item.color}}/></div>
                    <small>{item.name}</small>
                  </div>)}
                </div>:<div className="cr-muted-empty">
                  <i>—</i><strong>هنوز تحلیل نشده</strong>
                </div>}
                <div className="cr-ai-action">
                  <button type="button" className="cr-secondary" disabled={aiBusy||!totalCount} onClick={startLocalAI}>
                    <Icon name="spark" size={16}/>{aiBusy?"در حال تحلیل":aiComplete?"تحلیل مجدد":"اجرای تحلیل AI"}
                  </button>
                  {aiBusy&&<button type="button" className="cr-small-action" onClick={resetAnalysis}>لغو</button>}
                </div>
                {aiProgress&&<p aria-live="polite" className="cr-report-note">{aiBusy&&<i className="cr-spinner" style={{marginLeft:8}}/>}{aiProgress}</p>}
                {aiError&&<div role="alert" className="cr-status" data-danger="true">{aiError}</div>}
                <p className="cr-report-note">فقط نقدهای فیلم؛ واکنش‌های تریلر جدا هستند.</p>
              </div>
            </section>
            <section className="cr-ledger" aria-label="سهم منابع از نظرات">
              <div className="cr-ledger-top"><h3>منابع داده</h3><span>SOURCE / MIX</span></div>
              <div className="cr-ledger-body">
                <div className="cr-bars">
                  {result.sources.map((g,index)=><div key={g.source}>
                    <div className="cr-barlabel">
                      <span>{SOURCES.find(x=>x.id===g.source)?.name||g.source}
                        {g.category==="trailer"?" · تریلر":""}</span>
                      <strong>{g.comments.length}</strong>
                    </div>
                    <div className="cr-barline"><span style={{width:pct(g.comments.length,totalCount)+"%",
                      background:index===0?"#ed6748":index===1?"#adafa1":"#6e7163"}}/></div>
                  </div>)}
                  {!result.sources.length&&<span className="cr-muted-hint">منبعی دریافت نشد.</span>}
                </div>
                <p className="cr-report-note">امتیاز نویسندگان TMDB: {result.summary?.averageRating==null?"—":result.summary.averageRating+" از ۱۰"}</p>
              </div>
            </section>
          </div>
          <div className="cr-source-ledger">
            <div className="cr-ledger-top"><h3>منابع شناسایی‌شده</h3><span>MATCHED SOURCES</span></div>
            {result.sources.map((g,i)=><div className="cr-source-row" key={g.source}>
              <small>0{i+1}</small>
              <strong>{SOURCES.find(x=>x.id===g.source)?.name||g.source}</strong>
              <em>{g.comments.length}</em>
              <p title={g.matchedSource?.title||""}>{g.matchedSource?.title||"نقدهای فیلم"}
                {g.matchedSource?.confidence!=null?" · تطبیق "+Math.round(g.matchedSource.confidence*100)+"٪":""}</p>
              {g.matchedSource?.url?<a href={g.matchedSource.url} target="_blank" rel="noopener noreferrer">بازکردن ↗</a>:<span/>}
            </div>)}
          </div>
          <div className="cr-ai-action">
            <button type="button" className="cr-secondary" onClick={()=>setView("reviews")}>
              دیدن نظرات <Icon name="arrow" size={13}/>
            </button>
          </div>
        </>}

        {view==="reviews"&&result&&<>
          <div className="cr-controls">
            <div className="cr-filters" role="group" aria-label="فیلتر نظرات">
              {[["all","همه"],...(aiComplete?[["Positive","مثبت"],["Negative","منفی"],["Neutral","خنثی"],["Unclassified","نامشخص"]]:[])]
              .map(([id,title])=><button type="button" className="cr-filter" key={id}
                data-active={activeSentiment===id} aria-pressed={activeSentiment===id}
                onClick={()=>{setActiveSentiment(id);setPageSize(8);}}>{title}</button>)}
            </div>
            <div className="cr-filters">
              <input aria-label="جست‌وجو در نظرات" placeholder="جست‌وجو" value={commentKeyword}
                onChange={e=>{setCommentKeyword(e.target.value);setPageSize(8);}}/>
              <select aria-label="فیلتر منبع" value={activeSource}
                onChange={e=>{setActiveSource(e.target.value);setPageSize(8);}}>
                <option value="all">همه منابع</option>
                {result.sources.map(g=><option key={g.source} value={g.source}>
                  {SOURCES.find(x=>x.id===g.source)?.name||g.source}</option>)}
              </select>
            </div>
          </div>
          <section className="cr-comment-list" aria-label="نظرات فیلم">
            {visible.slice(0,pageSize).map((item,index)=>{
              const key=keyFor(item.group.source,item.comment);
              return <article key={key} className="cr-comment">
                <div className="cr-comment-index">
                  <span>{String(index+1).padStart(3,"0")}</span>
                  <span>{SOURCES.find(x=>x.id===item.group.source)?.name}</span>
                </div>
                <div className="cr-comment-body">
                  <div className="cr-comment-meta">
                    <strong>{item.comment.author||"کاربر"}</strong>
                    {item.ai&&<span className="cr-emotion" data-tone={item.ai.sentiment}>{LABEL_FA[item.ai.sentiment]||"نامشخص"}</span>}
                    {item.comment.rating!=null&&<span>امتیاز {item.comment.rating}/۱۰</span>}
                    {item.group.category==="trailer"&&<span>تریلر</span>}
                  </div>
                  <p dir="auto" className="cr-comment-text" data-expanded={Boolean(expanded[key])}>{item.comment.text}</p>
                  <div className="cr-filters">
                    {String(item.comment.text||"").length>220&&<button type="button" className="cr-small-action"
                      onClick={()=>setExpanded(o=>({...o,[key]:!o[key]}))}>{expanded[key]?"بستن":"ادامه"}</button>}
                    {item.comment.sourceUrl&&<a className="cr-small-action" href={item.comment.sourceUrl}
                      target="_blank" rel="noopener noreferrer">منبع ↗</a>}
                  </div>
                </div>
              </article>;
            })}
            {!visible.length&&<div className="cr-muted-empty"><i>∅</i><strong>نظری پیدا نشد</strong></div>}
          </section>
          {visible.length>pageSize&&<button type="button" className="cr-loadmore"
            onClick={()=>setPageSize(v=>v+8)}>نمایش بیشتر ({visible.length-pageSize})</button>}
          <div className="cr-report-note">{Math.min(pageSize,visible.length)} / {visible.length} نظر</div>
        </>}
        <div style={{marginTop:40,borderTop:"1px solid #393a32",paddingTop:15,color:"#74766b",fontSize:10,
          display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <span style={{direction:"ltr",fontFamily:"ui-monospace,monospace"}}>© CINESENSE / FRAME ROOM</span>
          <a style={{textDecoration:"none"}} href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
            Uses TMDB API. Not endorsed or certified by TMDB.
          </a>
        </div>
      </div>
    </div>
    <nav className="cr-mobile-nav" aria-label="ناوبری CineSense">
      {[["studio","search","فیلم"],["report","graph","گزارش"],["reviews","chat","نظرات"]].map(item=>
        <button type="button" key={item[0]} data-current={view===item[0]}
          aria-current={view===item[0]?"page":undefined} disabled={item[0]!=="studio"&&!result}
          onClick={()=>setView(item[0])}><Icon name={item[1]} size={19}/>{item[2]}</button>)}
    </nav>
  </main>;
}
