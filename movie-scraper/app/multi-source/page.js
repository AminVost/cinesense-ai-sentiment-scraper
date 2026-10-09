"use client";
import { useEffect, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Checkbox, Chip,
  Container, FormControlLabel, LinearProgress, TextField, Typography
} from "@mui/material";

const LABELS = { tmdb: "TMDB", youtube: "YouTube (نظرات تریلر)", digimoviez: "DigiMoviez" };
const PREDICTIONS = { Positive: "امتیاز مثبت", Neutral: "امتیاز متوسط", Negative: "امتیاز منفی", Unclassified: "بدون امتیاز" };

export default function MultiSourcePage() {
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [sources, setSources] = useState(["tmdb"]);
  const [youtubeVideoId, setYoutubeVideoId] = useState("");
  const [digimoviezUrl, setDigimoviezUrl] = useState("");
  const [maxComments, setMaxComments] = useState(20);
  const [providers, setProviders] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/providers")
      .then(async r => { if (!r.ok) throw Error("خطا در دریافت تنظیمات"); return r.json(); })
      .then(data => {
        setProviders(data);
        setSources(data.tmdb?.enabled ? ["tmdb"] : []);
      })
      .catch(() => setError("ارتباط با API سرور برقرار نیست."));
  }, []);

  useEffect(() => {
    if (query.trim().length < 2 || !providers?.tmdb?.enabled) { setMovies([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/search-movie", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }), signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "جست‌وجوی فیلم ناموفق بود.");
        setMovies(data.results || []);
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message);
      }
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, providers]);

  const toggle = (source, checked) => {
    setSources(prev => checked ? [...prev, source] : prev.filter(item => item !== source));
    setResult(null);
  };
  const score = summary => summary?.positivePercent === null || summary?.positivePercent === undefined
    ? "داده کافی وجود ندارد" : summary.positivePercent + "٪";
  const onlyAvailable = sources.every(source => providers?.[source]?.enabled);

  async function submit() {
    setError(""); setResult(null); setLoading(true);
    try {
      const response = await fetch("/api/analyze-movie", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources, tmdbId: selectedMovie?.id, youtubeVideoId, digimoviezUrl,
          maxComments: Number(maxComments),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "دریافت نظرات با خطا مواجه شد.");
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return <Container maxWidth="md" sx={{ py: 5, direction: "rtl" }}>
    <Typography variant="h4" fontWeight={700} gutterBottom>CineSense</Typography>
    <Typography variant="h6" sx={{ mb: 2 }}>بررسی نظرات فیلم از منابع بین‌المللی</Typography>
    <Alert severity="info" sx={{ mb: 2 }}>
      نسخه آنلاین رایگان: TMDB و YouTube از API رسمی استفاده می‌کنند. تحلیل هوش مصنوعی
      و استخراج DigiMoviez در این نسخه فعال نیستند. درصدهای TMDB فقط بر اساس
      <strong> امتیاز عددی ثبت‌شده توسط نویسندگان نقدها</strong> محاسبه می‌شوند، نه تحلیل احساسات متن.
    </Alert>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {providers && !providers.tmdb?.enabled &&
      <Alert severity="warning" sx={{ mb: 2 }}>
        کلید TMDB برای این محیط تنظیم نشده است. در تنظیمات Vercel مقدار TMDB_READ_ACCESS_TOKEN را اضافه کنید.
      </Alert>}
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {Object.entries(LABELS).map(([key, label]) =>
        <FormControlLabel key={key}
          control={<Checkbox checked={sources.includes(key)} disabled={!providers?.[key]?.enabled}
            onChange={event => toggle(key, event.target.checked)} />}
          label={label} />
      )}
    </Box>
    {sources.includes("tmdb") &&
      <Autocomplete options={movies} value={selectedMovie} filterOptions={x => x}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        getOptionLabel={movie => typeof movie === "string" ? movie :
          movie.title + (movie.release_date ? " (" + movie.release_date.slice(0, 4) + ")" : "")}
        onChange={(_event, movie) => setSelectedMovie(movie)}
        inputValue={query} onInputChange={(_event, value) => setQuery(value)}
        renderInput={params => <TextField {...params} fullWidth margin="normal"
          label="نام فیلم را جست‌وجو و از نتایج انتخاب کن" />} />}
    {sources.includes("youtube") &&
      <TextField fullWidth margin="normal" label="شناسه ۱۱ کاراکتری ویدئوی تریلر در YouTube"
        value={youtubeVideoId} onChange={event => setYoutubeVideoId(event.target.value)} />}
    <TextField fullWidth type="number" label="حداکثر نظرات هر منبع (۱ تا ۳۰)"
      margin="normal" value={maxComments} onChange={event => setMaxComments(event.target.value)}
      inputProps={{ min: 1, max: 30 }} />
    <Button variant="contained" sx={{ mt: 2 }}
      disabled={loading || sources.length === 0 || !onlyAvailable ||
        (sources.includes("tmdb") && !selectedMovie) ||
        (sources.includes("youtube") && !/^[A-Za-z0-9_-]{11}$/.test(youtubeVideoId)) ||
        Number(maxComments) < 1 || Number(maxComments) > 30}
      onClick={submit}>{loading ? "در حال دریافت نظرات..." : "دریافت نظرات"}
    </Button>
    {loading && <LinearProgress sx={{ mt: 2 }} />}

    {result && <Box sx={{ mt: 4 }}>
      <Card sx={{ mb: 2 }}><CardContent>
        <Typography variant="h6">درصد نقدهای دارای امتیاز مثبت: {score(result.summary)}</Typography>
        <Typography>نقدهای دریافت‌شده: {result.summary.total} | دارای امتیاز: {result.summary.rated ?? 0}</Typography>
        {result.summary.averageRating !== null &&
          <Typography>میانگین امتیاز نویسندگان این نقدها: {result.summary.averageRating} از ۱۰</Typography>}
        <Typography color="text.secondary">نظرات تریلر YouTube (جداگانه): {result.trailerSummary.total}</Typography>
      </CardContent></Card>
      {result.errors?.map(item =>
        <Alert key={item.source} severity="warning" sx={{ mb: 2 }}>{LABELS[item.source]}: {item.error}</Alert>)}
      {result.sources?.map(group =>
        <Card key={group.source} sx={{ mb: 2 }}><CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>{LABELS[group.source]} — {group.summary.total} نظر</Typography>
          {group.source === "tmdb" && <Typography color="text.secondary" sx={{ mb: 2 }}>
            امتیازهای کاربران در TMDB: {score(group.summary)} نقد دارای امتیاز مثبت
          </Typography>}
          {group.comments?.map((comment, index) =>
            <Box key={comment.id + "-" + index} sx={{ py: 2, borderTop: "1px solid #7773" }}>
              <Chip size="small" label={comment.rating !== null && comment.rating !== undefined
                ? "امتیاز " + comment.rating + "/۱۰ — " + PREDICTIONS[comment.sentiment]
                : "بدون امتیاز عددی"} />
              {comment.author && <Typography variant="caption" sx={{ mx: 1 }}>{comment.author}</Typography>}
              <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", mt: 1, direction: "auto" }}>
                {comment.text}
              </Typography>
              {comment.sourceUrl && <a href={comment.sourceUrl} target="_blank" rel="noopener noreferrer">
                مشاهده نظر اصلی
              </a>}
            </Box>)}
        </CardContent></Card>)}
    </Box>}

    <Box component="footer" sx={{ mt: 4, pt: 2, borderTop: "1px solid #7773" }}>
      <Typography variant="caption" color="text.secondary">
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", verticalAlign: "middle", marginLeft: 12 }}>
          <img width="46" height="34" alt="TMDB logo" style={{ objectFit: "contain" }}
            src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg" />
        </a>
        <span lang="en" dir="ltr">This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
        {" "}
        {" "}<a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a>
        {" — "}محتوا و حقوق نظرات متعلق به نویسندگان و منابع اصلی است.
      </Typography>
    </Box>
  </Container>;
}
