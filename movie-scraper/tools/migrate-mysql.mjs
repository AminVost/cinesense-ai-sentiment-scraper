// One-time database setup. Run from a secure machine with DATABASE_URL
// configured; this command is NEVER run on a user-facing API request.
import {readFileSync} from "node:fs";
import mysql from "mysql2/promise";

if(!process.env.DATABASE_URL?.trim())throw Error("DATABASE_URL is missing");
const url=new URL(process.env.DATABASE_URL);
if(url.protocol!=="mysql:"&&!url.protocol!=="mysqls:")throw Error("DATABASE_URL must be MySQL");
const connection=await mysql.createConnection({
  host:url.hostname,port:Number(url.port)||3306,
  user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),
  database:decodeURIComponent(url.pathname.slice(1)),
  ssl:process.env.DATABASE_TLS_DISABLED==="true"?undefined:{rejectUnauthorized:true},
  multipleStatements:true,connectTimeout:8000,timezone:"Z"
});
try{
  await connection.query(readFileSync(new URL("../db/schema.sql",import.meta.url),"utf8"));
  console.log("CineSense MySQL schema verified and applied.");
}finally{await connection.end();}
