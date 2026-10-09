"use client";
import { useEffect, useRef, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Checkbox, Chip,
  Container, FormControlLabel, LinearProgress, TextField, Typography
} from "@mui/material";

const LABELS = { tmdb: "TMDB", youtube: "YouTube (تریلر)", digimoviez: "DigiMoviez (آزمایشی)" };
const LABEL_FA = {Positive:"مثبت",Negative:"منفی",Neutral:"خنثی",Unclassified:"نامشخص"};
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
  const [youtubeVideoId,setYoutubeVideoId]=useState("");
  const [digimoviezUrl,setDigimoviezUrl]=useState("");
  const [scraperKey,setScraperKey]=useState("");
  const [maxComments,setMaxComments]=useState(10);
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
    setAiBusy(false);setAiError("");setAiProgress("");setAiResults({});
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
          sources:ordinary,tmdbId:selectedMovie?.id,youtubeVideoId,maxComments:Number(maxComments)
        }).then(data=>({type:"ordinary",data})));
      }
      if(sources.includes("digimoviez")){
        requests.push(postJson("/api/fetch-comments",{
          url:digimoviezUrl,maxComments:Math.min(10,Number(maxComments))
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
          groups.push({source:"digimoviez",category:"film",comments,hasMore:data.hasMore,
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
        setAiResults(next);setAiBusy(false);
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
    worker.postMessage({id,comments});
  }

  const stats=reviewAIStats(result,aiResults);
  const score=summary=>summary?.positivePercent==null?"داده کافی وجود ندارد":summary.positivePercent+"٪";
  const disabled=loading||!sources.length||sources.some(s=>!providers?.[s]?.enabled)
    ||(sources.includes("tmdb")&&!selectedMovie)
    ||(sources.includes("youtube")&&!/^[A-Za-z0-9_-]{11}$/.test(youtubeVideoId))
    ||(sources.includes("digimoviez")&&(!/^https:\/\//.test(digimoviezUrl)||!scraperKey.trim()))
    ||Number(maxComments)<1||Number(maxComments)>30;
  const filmCount=result?.sources.filter(g=>g.category==="film").reduce((n,g)=>n+g.comments.length,0)||0;
  return <Container maxWidth="md" sx={{py:5,direction:"rtl"}}>
    <Typography variant="h4" fontWeight={700} gutterBottom>CineSense</Typography>
    <Typography variant="h6" sx={{mb:2}}>تحلیل نظرات فیلم از منابع مختلف</Typography>
    <Alert severity="info" sx={{mb:2}}>
      ابزار رایگان: TMDB و YouTube از API رسمی استفاده می‌کنند. DigiMoviez با مرورگر سرورلس
      به‌صورت آزمایشی استخراج می‌شود. تحلیل AI به درخواست تو در مرورگر اجرا می‌شود؛ اولین استفاده
      مستلزم دانلود حدود ۱۷۰ مگابایت مدل است. مدل فعلی انگلیسی و پنج زبان اروپایی دیگر را هدف می‌گیرد؛
      متن فارسی و سایر زبان‌های پشتیبانی‌نشده «نامشخص» ثبت می‌شوند، نه مثبت یا منفی ساختگی.
    </Alert>
    {error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
    {providers&&!providers.tmdb?.enabled&&<Alert severity="warning">
      کلید TMDB روی Vercel ثبت نشده است.
    </Alert>}
    <Box sx={{display:"flex",flexWrap:"wrap",gap:1}}>
      {Object.entries(LABELS).map(([key,label])=>
        <FormControlLabel key={key} control={<Checkbox checked={sources.includes(key)}
          disabled={!providers?.[key]?.enabled}
          onChange={e=>toggle(key,e.target.checked)}/>} label={label}/>)}
    </Box>
    {sources.includes("tmdb")&&<Autocomplete options={movies} value={selectedMovie}
      filterOptions={x=>x} isOptionEqualToValue={(a,b)=>a.id===b.id}
      getOptionLabel={movie=>typeof movie==="string"?movie:
        movie.title+(movie.release_date?" ("+movie.release_date.slice(0,4)+")":"")}
      onChange={(_e,v)=>setSelectedMovie(v)}
      inputValue={query} onInputChange={(_e,v)=>setQuery(v)}
      renderInput={params=><TextField {...params} fullWidth margin="normal" label="نام فیلم را جست‌وجو و انتخاب کن"/>}/>}
    {sources.includes("digimoviez")&&<TextField fullWidth margin="normal"
      label="لینک HTTPS صفحه فیلم در DigiMoviez"
      value={digimoviezUrl} onChange={e=>setDigimoviezUrl(e.target.value)}/>}
    {sources.includes("digimoviez")&&<TextField fullWidth margin="normal" type="password" autoComplete="off"
      label="کد دسترسی خصوصی استخراج DigiMoviez" value={scraperKey}
      onChange={e=>setScraperKey(e.target.value)} helperText="برای محافظت از سهمیه رایگان سرور؛ فقط نزد مالک پروژه است." />}
    {sources.includes("youtube")&&<TextField fullWidth margin="normal"
      label="شناسه ۱۱ کاراکتری تریلر YouTube"
      value={youtubeVideoId} onChange={e=>setYoutubeVideoId(e.target.value)}/>}
    <TextField type="number" margin="normal" fullWidth label="حداکثر تعداد نظرات هر منبع (۱ تا ۳۰)"
      value={maxComments} onChange={e=>setMaxComments(e.target.value)}
      inputProps={{min:1,max:30}}/>
    <Button variant="contained" disabled={disabled} sx={{mt:2}} onClick={submit}>
      {loading?"در حال دریافت نظرات...":"دریافت نظرات"}
    </Button>
    {loading&&<LinearProgress sx={{mt:2}}/>}

    {result&&<Box sx={{mt:4}}>
      <Card sx={{mb:2}}><CardContent>
        <Typography variant="h6">نظرات فیلم دریافت‌شده: {filmCount}</Typography>
        <Typography>درصد مثبت بر اساس امتیاز ثبت‌شده نویسندگان در TMDB: {score(result.summary)}</Typography>
        {result.summary.averageRating!=null&&<Typography>
          میانگین امتیاز ثبت‌شده TMDB: {result.summary.averageRating} از ۱۰
        </Typography>}
        <Typography color="text.secondary">تعداد واکنش‌های تریلر (جداگانه): {result.trailerSummary.total}</Typography>
        {stats?.classified>0&&<Box sx={{mt:2}}>
          <Typography variant="h6">رضایت تخمینی از تحلیل متن با AI: {score(stats)}</Typography>
          <Typography color="text.secondary">تحلیل‌شده: {stats.classified} از {stats.total} نظر فیلم؛ این درصد جایگزین نظرسنجی نیست.</Typography>
        </Box>}
        <Box sx={{mt:2}}>
          <Button onClick={startLocalAI} disabled={aiBusy||!result.sources.some(x=>x.comments.length)}>
            {aiBusy?"هوش مصنوعی در حال تحلیل...":"شروع تحلیل متن با AI رایگان"}
          </Button>
          {aiBusy&&<Button onClick={resetAnalysis} color="inherit">لغو تحلیل</Button>}
          {!!aiProgress&&<Typography color="text.secondary">{aiProgress}</Typography>}
          {aiBusy&&<LinearProgress sx={{mt:1}}/>}
          {!!aiError&&<Alert severity="warning" sx={{mt:2}}>{aiError}</Alert>}
        </Box>
      </CardContent></Card>
      {result.errors.map((item,i)=><Alert severity="warning" sx={{mb:2}} key={item.source+i}>
        {LABELS[item.source]||item.source}: {item.error}
      </Alert>)}
      {result.sources.map(group=><Card key={group.source} sx={{mb:2}}><CardContent>
        <Typography variant="h6">{LABELS[group.source]} — {group.comments.length} نظر</Typography>
        {group.comments.map((comment,index)=>{
          const analysis=aiResults[keyFor(group.source,comment)];
          return <Box key={comment.id+"-"+index} sx={{borderTop:"1px solid #7773",py:2}}>
            <Box sx={{display:"flex",gap:1,flexWrap:"wrap",alignItems:"center"}}>
              <Chip size="small" label={comment.rating!=null
                ?"امتیاز نویسنده: "+comment.rating+"/۱۰":"بدون امتیاز عددی"}/>
              {analysis&&<Chip size="small" color={analysis.sentiment==="Positive"?"success":analysis.sentiment==="Negative"?"error":"default"}
                label={"AI: "+LABEL_FA[analysis.sentiment]}/>}
              {comment.author&&<Typography variant="caption">{comment.author}</Typography>}
            </Box>
            <Typography sx={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",mt:1,direction:"auto"}}>{comment.text}</Typography>
            {comment.sourceUrl&&<a href={comment.sourceUrl} target="_blank" rel="noopener noreferrer">مشاهده متن منبع</a>}
          </Box>;
        })}
      </CardContent></Card>)}
    </Box>}

    <Box component="footer" sx={{mt:4,pt:2,borderTop:"1px solid #7773"}}>
      <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" style={{display:"inline-block",verticalAlign:"middle",marginLeft:12}}>
        <img width="46" height="34" alt="TMDB logo" style={{objectFit:"contain"}}
          src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg"/>
      </a>
      <Typography component="span" variant="caption" lang="en" dir="ltr">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </Typography>
    </Box>
  </Container>;
}
