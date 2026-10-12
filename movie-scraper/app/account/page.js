"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import "./account.css";

async function requestApi(path,data,method="POST"){
  const response=await fetch(path,{
    method,cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:data?JSON.stringify(data):undefined,
    credentials:"same-origin"
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(json.error||"خطایی رخ داد؛ دوباره امتحان کنید.");
  return json;
}
export default function AccountPage(){
  const [enabled,setEnabled]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [token,setToken]=useState("");
  const [history,setHistory]=useState([]);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const verification=params.get("verify");
    const reset=params.get("reset");
    if(verification && /^[a-f0-9]{64}$/.test(verification)){setTab("verify");setToken(verification);}
    else if(reset && /^[a-f0-9]{64}$/.test(reset)){setTab("reset");setToken(reset);}
    fetch("/api/auth/me",{cache:"no-store"}).then(r=>r.json()).then(data=>{
      setEnabled(Boolean(data.enabled));setUser(data.user||null);
      if(data.user)fetch("/api/account/history",{cache:"no-store"}).then(r=>r.json()).then(a=>setHistory(a.history||[])).catch(()=>{});
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);
  function choose(next){setTab(next);setMessage("");setError("");setPassword("");}
  async function submit(event){
    event.preventDefault();setBusy(true);setMessage("");setError("");
    try{
      if(tab==="login"){
        const data=await requestApi("/api/auth/login",{email,password});
        setUser(data.user);setPassword("");setMessage("ورود موفق بود.");
        const info=await fetch("/api/account/history",{cache:"no-store"}).then(r=>r.json()).catch(()=>({}));
        setHistory(info.history||[]);
      }else if(tab==="register"||tab==="forgot"){
        const endpoint=tab==="register"?"/api/auth/register":"/api/auth/forgot";
        const data=await requestApi(endpoint,{email,...(tab==="register"?{password}:{})});
        setMessage(data.message);setPassword("");
      }else if(tab==="verify"||tab==="reset"){
        const endpoint=tab==="verify"?"/api/auth/verify":"/api/auth/reset";
        const data=await requestApi(endpoint,{token,password});
        setMessage(data.message);
        setPassword("");setToken("");
        setTimeout(()=>choose("login"),1500);
        window.history.replaceState({},"","/account");
      }
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function logout(){
    setBusy(true);
    try{await requestApi("/api/auth/logout");setUser(null);setHistory([]);setMessage("از حساب خارج شدید.");}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function deleteAccount(){
    if(!confirm("تمام اطلاعات حساب و تاریخچه شما حذف می‌شود. ادامه می‌دهید؟"))return;
    const secret=prompt("برای حذف حساب، رمز خود را وارد کنید:");
    if(!secret)return;
    setBusy(true);
    try{
      await requestApi("/api/account",{password:secret},"DELETE");
      setUser(null);setHistory([]);setMessage("حساب و تاریخچه شما حذف شد.");
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <main className="ac-layout" dir="rtl">
    <header className="ac-header">
      <Link href="/" className="ac-brand">CineSense <span> / ACCOUNT</span></Link>
      <Link href="/" className="ac-back">بازگشت به فیلم‌ها ↗</Link>
    </header>
    <div className="ac-content">
      <div className="ac-index">FRAME ROOM / IDENTITY</div>
      <h1>حساب کاربری</h1>
      {loading?<div className="ac-panel">در حال بررسی...</div>:
      !enabled?<div className="ac-panel" role="status">
        فعال‌سازی حساب کاربری به اتصال دیتابیس MySQL و سرویس تأیید ایمیل نیاز دارد. بخش تحلیل فیلم همچنان در دسترس است.
      </div>:
      user?<section className="ac-panel">
        <div className="ac-line"><strong>{user.email}</strong>
          <button type="button" className="ac-btn-subtle" disabled={busy} onClick={logout}>خروج از حساب</button></div>
        <h2>فیلم‌های بررسی‌شده</h2>
        {history.length?<div className="ac-history">{history.map(item=><div key={item.tmdbId} className="ac-history-row">
          <div><strong>{item.title}</strong>
            <small>{(item.sources||[]).join(" · ")} · {new Date(item.lastViewedAt).toLocaleDateString("fa-IR")}</small></div>
          <Link href={"/multi-source?movie="+item.tmdbId}>بررسی مجدد ↗</Link>
        </div>)}</div>:<p className="ac-muted">هنوز فیلمی بررسی نکرده‌ای.</p>}
        <div className="ac-danger"><button type="button" disabled={busy} onClick={deleteAccount}>حذف دائمی حساب و تاریخچه</button></div>
      </section>:
      <section className="ac-panel">
        {!(tab==="verify"||tab==="reset")&&<div className="ac-tabs">
          <button type="button" data-active={tab==="login"} onClick={()=>choose("login")}>ورود</button>
          <button type="button" data-active={tab==="register"} onClick={()=>choose("register")}>ثبت‌نام</button>
        </div>}
        <form onSubmit={submit}>
          {(tab==="verify"||tab==="reset")&&<h2>{tab==="verify"?"تأیید ایمیل":"تغییر رمز"}</h2>}
          {!["verify","reset"].includes(tab)&&<label>ایمیل
            <input autoComplete="email" type="email" dir="ltr" required maxLength={254} value={email}
              onChange={e=>setEmail(e.target.value)}/></label>}
          {["login","register","reset","verify"].includes(tab)&&<label>رمز عبور
            <input autoComplete={tab==="login"||tab==="verify"?"current-password":"new-password"} type="password"
              required minLength={tab==="login"?1:12} maxLength={128} value={password}
              onChange={e=>setPassword(e.target.value)}/></label>}
          {error&&<p role="alert" className="ac-error">{error}</p>}
          {message&&<p role="status" className="ac-success">{message}</p>}
          <button type="submit" className="ac-primary" disabled={busy}>{busy?"در حال پردازش...":
            tab==="login"?"ورود":tab==="register"?"ثبت‌نام و ارسال ایمیل":
            tab==="forgot"?"ارسال لینک بازیابی":tab==="verify"?"تأیید ایمیل":"ذخیره رمز جدید"}</button>
        </form>
        {tab==="login"&&<button className="ac-text-btn" type="button" onClick={()=>choose("forgot")}>رمز عبور را فراموش کرده‌ام</button>}
        {tab==="forgot"&&<button className="ac-text-btn" type="button" onClick={()=>choose("login")}>بازگشت به ورود</button>}
        <p className="ac-muted">نشست ورود به‌صورت کوکی امن ذخیره می‌شود؛ فایل مدل‌های AI فقط در مرورگر شما کش می‌شوند.</p>
      </section>}
    </div>
  </main>;
}
