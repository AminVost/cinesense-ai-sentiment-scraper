"use client";
import { useEffect, useState } from "react";
import { Container, Typography, TextField, Button, Box, Card, CardContent, Checkbox, FormControlLabel, Alert, LinearProgress, Autocomplete, Chip } from "@mui/material";
export default function MultiSourcePage() {
  const [query, setQuery] = useState(""), [movies, setMovies] = useState([]), [selectedMovie, setSelectedMovie] = useState(null);
  const [sources, setSources] = useState(["tmdb"]), [digimoviezUrl, setDigimoviezUrl] = useState(""), [youtubeVideoId, setYoutubeVideoId] = useState("");
  const [maxComments, setMaxComments] = useState(20), [providers, setProviders] = useState(null), [result, setResult] = useState(null), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  useEffect(() => {
    fetch("/api/providers").then(r => r.json()).then(setProviders).catch(() => setError("اتصال به سرور برقرار نیست."));
  }, []);
  useEffect(() => {
    if (query.trim().length < 2 || !providers?.tmdb?.enabled) { setMovies([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/search-movie", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({query}), signal:controller.signal });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "جست‌وجو ناموفق بود");
        setMovies(data.results || []);
      } catch (e) { if (e.name !== "AbortError") setError(e.message); }
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, providers]);
  const toggle = (source, checked) => { setSources(prev => checked ? [...prev,source] : prev.filter(s => s !== source)); setResult(null); };
  async function submit() {
    setError(""); setResult(null); setLoading(true);
    try {
      const r = await fetch("/api/analyze-movie", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({sources,tmdbId:selectedMovie?.id,digimoviezUrl,youtubeVideoId,maxComments:Number(maxComments)}) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "تحلیل ناموفق بود");
      setResult(data);
    } catch(e) {setError(e.message);} finally {setLoading(false);}
  }
  const score = s => s.positivePercent === null ? "ناموجود" : s.positivePercent + "٪";
  return <Container maxWidth="md" sx={{py:5,direction:"rtl"}}>
    <Typography variant="h4" gutterBottom>CineSense — تحلیل چندمنبعی</Typography>
    <Typography sx={{mb:2}}>نظرات فیلم و واکنش به تریلر جداگانه تحلیل می‌شوند.</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {([["tmdb","TMDB"],["digimoviez","DigiMoviez"],["youtube","YouTube (تریلر)"]]).map(([key,label])=><FormControlLabel key={key} control={<Checkbox checked={sources.includes(key)} disabled={providers?.[key]?.enabled===false} onChange={e=>toggle(key,e.target.checked)}/>} label={label}/>)}
    {sources.includes("tmdb") && <Autocomplete options={movies} value={selectedMovie} filterOptions={x=>x} isOptionEqualToValue={(a,b)=>a.id===b.id} getOptionLabel={m=>typeof m==="string"?m:m.title+" ("+(m.release_date||"").slice(0,4)+")"} onChange={(_e,m)=>setSelectedMovie(m)} inputValue={query} onInputChange={(_e,v)=>setQuery(v)} renderInput={params=><TextField {...params} margin="normal" fullWidth label="جست‌وجوی نام فیلم"/>}/>}
    {sources.includes("digimoviez") && <TextField fullWidth margin="normal" label="لینک HTTPS فیلم در DigiMoviez" value={digimoviezUrl} onChange={e=>setDigimoviezUrl(e.target.value)}/>}
    {sources.includes("youtube") && <TextField fullWidth margin="normal" label="شناسه ۱۱ کاراکتری تریلر YouTube" value={youtubeVideoId} onChange={e=>setYoutubeVideoId(e.target.value)}/>}
    <TextField fullWidth type="number" margin="normal" label="تعداد نظرات هر منبع (۱ تا ۱۰۰)" value={maxComments} onChange={e=>setMaxComments(e.target.value)} inputProps={{min:1,max:100}}/>
    <Button variant="contained" sx={{mt:2}} disabled={loading||!sources.length||(sources.includes("tmdb")&&!selectedMovie)||(sources.includes("digimoviez")&&!digimoviezUrl)||(sources.includes("youtube")&&!youtubeVideoId)} onClick={submit}>{loading?"در حال تحلیل...":"شروع تحلیل"}</Button>
    {loading && <LinearProgress sx={{mt:2}}/>}
    {result && <Box sx={{mt:4}}>
      <Alert severity="info" sx={{mb:2}}>نتایج فقط نمونه نظرات دریافت‌شده‌اند و معیار قطعی رضایت همه کاربران نیستند.</Alert>
      <Card sx={{mb:2}}><CardContent><Typography variant="h6">رضایت از فیلم: {score(result.summary)}</Typography><Typography>تعداد نظر: {result.summary.total} | تحلیل‌شده: {result.summary.classified}</Typography><Typography>واکنش به تریلر: {score(result.trailerSummary)}</Typography></CardContent></Card>
      {(result.errors||[]).map(e=><Alert key={e.source} severity="warning" sx={{mb:1}}>{e.source}: {e.error}</Alert>)}
      {result.sources.map(group=><Card key={group.source} sx={{mb:2}}><CardContent><Typography variant="h6">{group.source} — {score(group.summary)} ({group.summary.total} نظر)</Typography>{group.comments.map((c,i)=><Box key={c.id+"-"+i} sx={{borderBottom:"1px solid #7773",py:2}}><Chip label={c.sentiment||"Unclassified"} size="small"/><Typography sx={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",mt:1}}>{c.text}</Typography>{c.sourceUrl && <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">منبع نظر</a>}</Box>)}</CardContent></Card>)}
    </Box>}
  </Container>;
}
