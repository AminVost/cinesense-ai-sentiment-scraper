"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import "./cinesense-v2.css";

const LABELS = { tmdb: "TMDB", youtube: "YouTube (تریلر)", digimoviez: "DigiMoviez (آزمایشی)" };
const LABEL_FA = {Positive:"مثبت",Negative:"منفی",Neutral:"خنثی",Unclassified:"نامشخص"};
const SOURCES = [{id:"tmdb",name:"TMDB",desc:"نقدهای فیلم",tone:"#92e6cc",icon:"film"},{id:"youtube",name:"YouTube",desc:"واکنش‌های تریلر",tone:"#f49f9d",icon:"play"},{id:"digimoviez",name:"DigiMoviez",desc:"نظرات فارسی",tone:"#b6a4ff",icon:"chat"}];
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
    if(query.trim().length<2||!providers?.tmdb?.enabled){setMovies([]);return;}
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      try{
        const response=await fetch("/api/search-movie",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({query}),signal:controller.signal});
        const data=await response.json();
        if(!response.ok)throw Error(data.error||"جست‌وجوی فیلم ناموفق بود.");
        setMovies(data.results||[]);
      }catch(e){if(e.name!=="AbortError")setError(e.message);}
    },450);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[query,providers]);
  function resetAnalysis(){
    workerRef.current?.terminate();workerRef.current=null;runId.current++;
    setAiBusy(false);setAiError("");setAiProgress("");setAiResults({});setAiComplete(false);
  }
  function toggle(source,checked){
    setSources(prev=>checked?[...prev,source]:prev.filter(s=>s!==source));
    setResult(null);resetAnalysis();
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
  const segments=[{id:"Positive",color:"#92e6cc",name:"مثبت"},{id:"Neutral",color:"#ebc986",name:"خنثی"},
    {id:"Negative",color:"#f49f9d",name:"منفی"},{id:"Unclassified",color:"#555b78",name:"تحلیل‌نشده"}];
  const filmValues=segments.map(seg=>({...seg,count:result?.sources.filter(g=>g.category==="film").flatMap(g=>g.comments)
    .filter(c=>(aiResults[keyFor(c.source,c)]?.sentiment||"Unclassified")===seg.id).length||0}));
  const classified=stats?.classified||0;
  const pct=(count,total)=>total?Math.round(100*count/total):0;
  const pos=filmValues[0].count,neu=filmValues[1].count,neg=filmValues[2].count;
  const gradient=filmCount? "conic-gradient(#92e6cc 0 "+pct(pos,filmCount)+"%,#ebc986 "+pct(pos,filmCount)+"% "+pct(pos+neu,filmCount)+"%,#f49f9d "+pct(pos+neu,filmCount)+"% "+pct(pos+neu+neg,filmCount)+"%,#555b78 "+pct(pos+neu+neg,filmCount)+"% 100%)":"#555b78";
  const protectedSelected=sources.includes("youtube")||sources.includes("digimoviez");

  return <main className="cs-app" dir="rtl">
    <div className="cs-container">
      <header className="cs-header">
        <a className="cs-brand" href="/" aria-label="CineSense، صفحه اصلی">
          <span className="cs-logo"><Icon name="film" size={23}/></span>
          <span className="cs-brand-word">Cine<span>Sense</span></span>
        </a>
        <nav className="cs-header-side" aria-label="منوی اصلی">
          <a href="#workspace" className="cs-nav-link">استودیوی تحلیل</a>
          <a href="#how-it-works" className="cs-nav-link">نحوه کار</a>
          <span className="cs-live-chip"><span className="cs-live-dot"/> هوش مصنوعی محلی</span>
        </nav>
      </header>

      <section className="cs-hero" aria-labelledby="cs-hero-heading">
        <div>
          <div className="cs-eyebrow">CINEMATIC INTELLIGENCE / V2</div>
          <h1 id="cs-hero-heading">هر فیلم، هزار نگاه.<span>یک تحلیل روشن.</span></h1>
          <p className="cs-hero-desc">فراتر از امتیازها برو. یک فیلم را انتخاب کن تا CineSense
            نظرات منابع مختلف را به صورت خودکار پیدا کند و با هوش مصنوعی رایگان تحلیل کند.</p>
          <div className="cs-hero-trust">
            <span><Icon name="check" size={16}/> بدون وارد کردن لینک</span>
            <span><Icon name="shield" size={16}/> حریم خصوصی</span>
            <span><Icon name="spark" size={16}/> بدون API هوش مصنوعی پولی</span>
          </div>
        </div>
        <div className="cs-art" aria-hidden="true">
          <div className="cs-art-ring"/><div className="cs-art-ring"/><div className="cs-art-ring"/>
          <div className="cs-orbit-center"><Icon name="spark" size={60}/></div>
          <div className="cs-orbit-pill cs-a"><Icon name="film" size={15}/> MOVIE REVIEWS</div>
          <div className="cs-orbit-pill cs-b"><Icon name="graph" size={15}/> SENTIMENT INSIGHTS</div>
          <div className="cs-orbit-pill cs-c"><Icon name="bolt" size={15}/> LOCAL AI</div>
        </div>
      </section>

      <section id="workspace" className="cs-workspace" aria-label="استودیوی جست‌وجو">
        <div className="cs-panel cs-primary">
          <div className="cs-panel-kicker"><Icon name="spark" size={15}/> ANALYSIS STUDIO</div>
          <h2 className="cs-panel-title">از اینجا شروع کن</h2>
          <p className="cs-panel-desc">فقط نام فیلم را انتخاب کن؛ پیدا کردن منابع با ما.</p>
          <label className="cs-label" htmlFor="cs-movie-search">فیلم مورد نظرت</label>
          <Autocomplete id="cs-movie-search" className="cs-search"
            options={movies} value={selectedMovie} inputValue={query}
            loading={searchBusy} filterOptions={items=>items}
            disabled={!providers?.tmdb?.enabled||loading}
            isOptionEqualToValue={(a,b)=>a.id===b.id}
            getOptionLabel={movie=>typeof movie==="string"?movie:
              movie.title+(movie.release_date?" ("+movie.release_date.slice(0,4)+")":"")}
            onChange={(_e,v)=>{setSelectedMovie(v);setResult(null);resetAnalysis();setActiveSource("all");setActiveSentiment("all");setPageSize(8);}}
            onInputChange={(_e,v,reason)=>{setQuery(v);if(reason==="input"||reason==="clear"){setSelectedMovie(null);setResult(null);resetAnalysis();}}}
            noOptionsText={query.length<2?"حداقل دو حرف بنویس":"فیلمی پیدا نشد"}
            loadingText="در حال جست‌وجوی فیلم..."
            slotProps={{paper:{sx:{bgcolor:"#191c2a",color:"#f5f4fa",border:"1px solid #45405f",
              borderRadius:"14px", "& .MuiAutocomplete-option.Mui-focused":{background:"#302b46!important"},
              "& .MuiAutocomplete-option[aria-selected=true]":{background:"#3e345a!important"}}}}}
            renderOption={(props,movie)=>{
              const {key,...rest}=props;
              return <li key={key} {...rest} style={{display:"flex",gap:12,alignItems:"center",direction:"rtl",padding:10}}>
                <Poster movie={movie}/>
                <span><strong style={{fontSize:12}}>{movie.title}</strong>
                <span style={{display:"block",fontSize:11,color:"#a9a1c0"}}>{movie.release_date?.slice(0,4)||"بدون سال"}</span></span>
              </li>;
            }}
            renderInput={params=><TextField {...params} placeholder="مثلاً Interstellar یا Inception"
              inputProps={{...params.inputProps,"aria-label":"جست‌وجوی نام فیلم"}}/>}
          />
          {selectedMovie&&<div className="cs-selected-movie">
            <Poster movie={selectedMovie}/>
            <div><p className="cs-movie-title">{selectedMovie.title}</p>
              <div className="cs-movie-meta">{selectedMovie.release_date?.slice(0,4)||"—"} · فیلم انتخاب شد</div></div>
            <span style={{marginRight:"auto",color:"#92e6cc"}}><Icon name="check" size={20}/></span>
          </div>}

          <div className="cs-source-heading">
            <span className="cs-label">منابع داده</span>
            <span className="cs-source-note">می‌توانی چند منبع انتخاب کنی</span>
          </div>
          <div className="cs-sources">
            {SOURCES.map(source=><button type="button" key={source.id} className="cs-source"
              data-source={source.id} data-checked={sources.includes(source.id)}
              aria-pressed={sources.includes(source.id)}
              disabled={!providers?.[source.id]?.enabled||loading}
              onClick={()=>{toggle(source.id,!sources.includes(source.id));setActiveSource("all");setActiveSentiment("all");setPageSize(8);}}>
              <span className="cs-source-top">
                <span className="cs-source-icon"><Icon name={source.icon} size={19}/></span>
                <span className="cs-source-check">{sources.includes(source.id)&&<Icon name="check" size={13}/>}</span>
              </span>
              <span className="cs-source-name">{source.name}</span>
              <span className="cs-source-sub">{providers?.[source.id]?.enabled?source.desc:"فعلاً در دسترس نیست"}</span>
            </button>)}
          </div>

          <details className="cs-settings">
            <summary><span><Icon name="sliders" size={16}/> تنظیمات پیشرفته و دسترسی منابع</span>
              <Icon name="down" size={16} className="cs-down"/></summary>
            <div className="cs-settings-body">
              <div>
                <label className="cs-label" htmlFor="cs-max">تعداد نظرات هر منبع</label>
                <select id="cs-max" className="cs-field" value={maxComments}
                  disabled={loading} onChange={e=>{setMaxComments(Number(e.target.value));setResult(null);resetAnalysis();}}>
                  {[5,10,20,30].map(n=><option value={n} key={n}>{n} نظر</option>)}
                </select>
                <p className="cs-field-hint">DigiMoviez حداکثر ۱۰ نظر دریافت می‌کند.</p>
              </div>
              <div>
                <label className="cs-label" htmlFor="cs-secret">کد خصوصی منابع محافظت‌شده</label>
                <div style={{display:"flex",gap:6}}>
                  <input className="cs-field" id="cs-secret" type={secretVisible?"text":"password"}
                    autoComplete="off" value={scraperKey} onChange={e=>setScraperKey(e.target.value)}
                    placeholder="کد دسترسی CineSense" aria-describedby="cs-secret-hint"/>
                  <button className="cs-button-outline" type="button" onClick={()=>setSecretVisible(v=>!v)}
                    aria-label={secretVisible?"پنهان کردن کد":"نمایش کد"} title={secretVisible?"پنهان کردن کد":"نمایش کد"}
                    style={{minHeight:46,padding:"0 12px"}}><Icon name="eye" size={15}/></button>
                </div>
                <p className="cs-field-hint" id="cs-secret-hint">برای YouTube و DigiMoviez؛ کد ذخیره نمی‌شود.</p>
              </div>
            </div>
          </details>
          {protectedSelected&&!scraperKey.trim()&&<p className="cs-field-hint" style={{color:"#e6cba7",marginTop:12}}>
            برای دریافت نظرات منابع انتخاب‌شده کد خصوصی را از تنظیمات پیشرفته وارد کن.
          </p>}
          {error&&<div role="alert" className="cs-alert" data-tone="error"><Icon name="info" size={18}/>{error}</div>}
          {providers&&!providers.tmdb?.enabled&&<div role="alert" className="cs-alert">سرویس TMDB در دسترس نیست.</div>}

          <div className="cs-action-row">
            <button type="button" className="cs-button-primary" disabled={disabled} onClick={submit}>
              <Icon name={loading?"graph":"search"} size={19}/>
              {loading?"در حال یافتن منابع و نظرات...":"پیدا کردن و دریافت نظرات"}
              {!loading&&<Icon name="arrow" size={16}/>}
            </button>
            <span className="cs-note">جست‌وجوی منابع بعد از زدن دکمه انجام می‌شود.</span>
          </div>
          {loading&&<div aria-live="polite">
            <div className="cs-progress-track"><div/></div>
            <p className="cs-field-hint" style={{marginTop:10}}>در حال تطبیق عنوان و سال فیلم و خواندن نظرات...</p>
          </div>}
        </div>
        <aside id="how-it-works" className="cs-side">
          <div className="cs-panel">
            <h3 className="cs-side-title">سه قدم تا تصویر روشن‌تر</h3>
            {[
              ["01","فیلم را انتخاب کن","نام فیلم را جست‌وجو کن و عنوان درست را انتخاب کن."],
              ["02","منابع را پیدا می‌کنیم","عنوان و سال ساخت بررسی می‌شود؛ لینک لازم نیست."],
              ["03","احساسات را تحلیل کن","متن نظرات با مدل محلی رایگان بررسی می‌شود."]
            ].map(item=><div key={item[0]} className="cs-step">
              <span className="cs-step-num">{item[0]}</span>
              <div><h4>{item[1]}</h4><p>{item[2]}</p></div>
            </div>)}
          </div>
          <div className="cs-panel cs-side-glow">
            <span className="cs-panel-kicker"><Icon name="shield" size={15}/> PRIVACY FIRST</span>
            <div className="cs-side-big">LOCAL <span style={{color:"#b2a2f7"}}>AI</span></div>
            <p style={{fontSize:11,color:"#aba9c2",margin:0}}>مدل روی مرورگر کاربر اجرا می‌شود؛ فقط برای دانلود اولیه به اینترنت نیاز است.</p>
          </div>
        </aside>
      </section>

      {result&&<div>
        <section className="cs-section" id="report">
          <div className="cs-section-top">
            <div><span className="cs-panel-kicker"><Icon name="graph" size={15}/> MOVIE INTELLIGENCE</span>
              <h2 className="cs-section-title">گزارش تحلیل فیلم</h2>
              <p className="cs-section-caption">آمار نظرات فیلم و واکنش به تریلر جدا محاسبه می‌شوند.</p>
            </div>
            {selectedMovie&&<div className="cs-results-movie"><Poster movie={selectedMovie}/>
              <div><span className="cs-results-eyebrow">FILM REPORT</span>
              <div style={{fontSize:13,fontWeight:750}}>{selectedMovie.title}</div>
              <div className="cs-movie-meta">{selectedMovie.release_date?.slice(0,4)}</div></div>
            </div>}
          </div>
          {result.errors.map((e,i)=><div key={i} className="cs-alert" role="status" style={{margin:"0 0 12px"}}>
            <Icon name="info" size={18}/>{LABELS[e.source]||e.source}: {e.error}
          </div>)}
          <div className="cs-stats">
            {[
              ["chat","نظرات دریافت‌شده",totalCount,"تمام منابع"],
              ["globe","منابع بررسی‌شده",result.sources.length,"از "+sources.length+" منبع انتخاب‌شده"],
              ["film","میانگین امتیاز TMDB",result.summary.averageRating==null?"—":result.summary.averageRating+"/10","امتیازهای نویسندگان"],
              ["spark","نظرات مثبت AI فیلم",aiComplete&&stats?.positivePercent!=null?stats.positivePercent+"٪":"—",aiComplete?"فقط نقدهای فیلم":"هنوز تحلیل نشده"]
            ].map(item=><article key={item[1]} className="cs-stat-card">
              <div className="cs-stat-label"><Icon name={item[0]} size={16}/>{item[1]}</div>
              <div className="cs-stat-value">{item[2]}</div>
              <div className="cs-stat-foot">{item[3]}</div>
            </article>)}
          </div>
        </section>

        <section className="cs-section" id="insights">
          <div className="cs-section-top">
            <div><h2 className="cs-section-title">نبض نظرات</h2>
              <p className="cs-section-caption">ارزیابی متن نظرات فیلم، مستقل از امتیاز ثبت‌شده نویسنده.</p></div>
            <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
              {aiComplete&&<span className="cs-live-chip"><span className="cs-live-dot"/> تحلیل تکمیل شد</span>}
              <button type="button" className="cs-button-outline" disabled={aiBusy||!totalCount} onClick={startLocalAI}>
                <Icon name="spark" size={16}/>{aiBusy?"در حال تحلیل...":aiComplete?"تحلیل دوباره AI":"شروع تحلیل احساسات AI"}
              </button>
              {aiBusy&&<button type="button" className="cs-button-outline" onClick={resetAnalysis}>لغو</button>}
            </div>
          </div>
          {aiProgress&&<p aria-live="polite" className="cs-note">{aiProgress}</p>}
          {aiBusy&&<div className="cs-progress-track" style={{margin:"8px 0 15px"}}><div/></div>}
          {aiError&&<div className="cs-alert" data-tone="error" role="alert">{aiError}</div>}
          <div className="cs-insights-grid">
            <article className="cs-insight-panel">
              <h3 className="cs-insight-title">توزیع احساسات فیلم</h3>
              <p className="cs-insight-sub">فقط متن نقدهای فیلم؛ کامنت‌های تریلر جدا هستند.</p>
              {aiComplete&&filmCount>0?<div className="cs-donut-layout">
                <div className="cs-donut" style={{background:gradient}} role="img" aria-label={classified+" نظر از "+filmCount+" نظر فیلم تحلیل شده‌اند."}>
                  <div className="cs-donut-core"><strong>{classified}</strong><span>نظر تحلیل‌شده</span></div>
                </div>
                <div className="cs-legend">
                  {filmValues.map(item=><div className="cs-legend-item" key={item.id}>
                    <span className="cs-legend-dot" style={{background:item.color}}/>
                    <span>{item.name}</span><em>{item.count}</em>
                  </div>)}
                </div>
              </div>:<div className="cs-empty-state">
                <span className="cs-empty-orb"><Icon name="spark" size={23}/></span>
                <strong>آماده تحلیل</strong>
                <p>برای دیدن توزیع واقعی احساسات، تحلیل AI را اجرا کن.</p>
              </div>}
            </article>
            <article className="cs-insight-panel">
              <h3 className="cs-insight-title">سهم منابع از نظرات</h3>
              <p className="cs-insight-sub">تعداد نظرات جمع‌آوری‌شده از هر سرویس</p>
              <div className="cs-breakdown">
                {result.sources.map(g=><div key={g.source}>
                  <div className="cs-breakdown-head"><span>{LABELS[g.source]}{g.category==="trailer"?" (تریلر)":""}</span>
                    <span dir="ltr">{g.comments.length} / {totalCount}</span></div>
                  <div className="cs-bar"><span style={{width:pct(g.comments.length,totalCount)+"%",background:SOURCES.find(s=>s.id===g.source)?.tone||"#a996ff"}}/></div>
                </div>)}
              </div>
              <p className="cs-note" style={{margin:"23px 0 0"}}>تعداد واکنش‌های تریلر ({totalTrailer}) در شاخص رضایت از خود فیلم محاسبه نمی‌شود.</p>
            </article>
          </div>
        </section>

        <section className="cs-section">
          <div className="cs-section-top"><div><h2 className="cs-section-title">منابع پیدا‌شده</h2>
            <p className="cs-section-caption">شفاف درباره فیلم، تریلر و محل دریافت هر نظر.</p></div></div>
          <div className="cs-source-results">
            {result.sources.map(g=><article className="cs-source-result" key={g.source}>
              <div className="cs-result-row"><h3>{SOURCES.find(s=>s.id===g.source)?.name||g.source}</h3>
                <span className="cs-result-badge">{g.category==="trailer"?"واکنش تریلر":"نقد فیلم"}</span></div>
              <strong className="cs-count">{g.comments.length}</strong>
              <p className="cs-result-meta">{g.matchedSource?.title||"نقدهای فیلم از TMDB"}
                {g.matchedSource?.channel?" · "+g.matchedSource.channel:""}</p>
              <div className="cs-row-between">
                {g.matchedSource?.url?<a className="cs-matched-link" href={g.matchedSource.url}
                  target="_blank" rel="noopener noreferrer">مشاهده منبع <Icon name="arrow" size={13}/></a>:
                  <span className="cs-note">منبع رسمی نظرات</span>}
                {g.matchedSource?.confidence!=null&&<span className="cs-note">تطبیق تخمینی: {Math.round(g.matchedSource.confidence*100)}٪</span>}
              </div>
            </article>)}
          </div>
        </section>

        <section className="cs-section" id="comments">
          <div className="cs-explorer">
            <div className="cs-section-top"><div><h2 className="cs-section-title">مرورگر نظرات</h2>
              <p className="cs-section-caption">متن نظرات را جست‌وجو و بر اساس منبع و احساسات فیلتر کن.</p></div>
              <span className="cs-note">نمایش {Math.min(visible.length,pageSize)} از {visible.length} نظر</span></div>
            <div className="cs-filter-row">
              <div className="cs-filter-buttons" role="group" aria-label="فیلتر احساسات">
                {[["all","همه"],...(aiComplete?[["Positive","مثبت"],["Neutral","خنثی"],["Negative","منفی"],["Unclassified","تحلیل‌نشده"]]:[])]
                .map(item=><button type="button" className="cs-filter-button" key={item[0]}
                  aria-pressed={activeSentiment===item[0]} data-active={activeSentiment===item[0]}
                  onClick={()=>{setActiveSentiment(item[0]);setPageSize(8);}}>{item[1]}</button>)}
              </div>
              <div className="cs-filter-tools">
                <input value={commentKeyword} onChange={e=>{setCommentKeyword(e.target.value);setPageSize(8);}}
                  aria-label="جست‌وجو در نظرات" placeholder="جست‌وجو در نظرات..."/>
                <select aria-label="فیلتر منبع" value={activeSource} onChange={e=>{setActiveSource(e.target.value);setPageSize(8);}}>
                  <option value="all">همه منابع</option>
                  {result.sources.map(g=><option key={g.source} value={g.source}>{SOURCES.find(s=>s.id===g.source)?.name||g.source}</option>)}
                </select>
              </div>
            </div>
            <div className="cs-comment-list">
              {visible.slice(0,pageSize).map(item=>{
                const key=keyFor(item.group.source,item.comment);
                return <article className="cs-comment" key={key}>
                  <div className="cs-comment-meta">
                    <span className="cs-comment-source">{SOURCES.find(s=>s.id===item.group.source)?.name||item.group.source}</span>
                    {item.comment.author&&<span className="cs-comment-author">{item.comment.author}</span>}
                    {item.ai&&<span className="cs-sentiment-chip" data-tone={item.ai.sentiment}>{LABEL_FA[item.ai.sentiment]||"نامشخص"}</span>}
                    {item.comment.rating!=null&&<span className="cs-comment-author">امتیاز نویسنده: {item.comment.rating} از ۱۰</span>}
                  </div>
                  <p className="cs-comment-text" dir="auto" data-expanded={Boolean(expanded[key])}>{item.comment.text}</p>
                  <div className="cs-comment-footer">
                    {String(item.comment.text).length>220&&<button type="button"
                      onClick={()=>setExpanded(old=>({...old,[key]:!old[key]}))}>{expanded[key]?"نمایش کمتر":"خواندن کامل"}</button>}
                    {item.comment.sourceUrl&&<a href={item.comment.sourceUrl} target="_blank" rel="noopener noreferrer">
                      مشاهده متن در منبع <Icon name="arrow" size={12}/></a>}
                  </div>
                </article>;
              })}
              {!visible.length&&<div className="cs-empty-state"><span className="cs-empty-orb"><Icon name="search"/></span>
                <strong>نظری با این فیلتر پیدا نشد</strong>
                <p>عبارت جست‌وجو یا فیلترها را تغییر بده.</p></div>}
            </div>
            {visible.length>pageSize&&<button type="button" className="cs-more-button"
              onClick={()=>setPageSize(v=>v+8)}>نمایش نظرات بیشتر ({visible.length-pageSize}) <Icon name="down" size={14}/></button>}
          </div>
        </section>
      </div>}

      <footer className="cs-footer">
        <div><span className="cs-brand-word" style={{fontSize:16}}>Cine<span>Sense</span></span>
          <span style={{marginRight:12}}>Designed for curious movie minds.</span></div>
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" lang="en">
          This product uses the TMDB API but is not endorsed or certified by TMDB.</a>
      </footer>
    </div>
  </main>;
}
