import mysql from "mysql2/promise";

let pool;
export const dbReady = () => Boolean(process.env.DATABASE_URL?.trim());

export function database() {
  if (!dbReady()) throw Error("DATABASE_URL is not configured");
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL);
    if (!["mysql:", "mysqls:"].includes(url.protocol)) throw Error("DATABASE_URL must be a MySQL URL");
    if (!url.hostname || !url.pathname.slice(1) || !url.username) throw Error("Invalid MySQL URL");
    pool = mysql.createPool({
      host: url.hostname, port: Number(url.port) || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl: process.env.DATABASE_TLS_DISABLED === "true" ? undefined : { rejectUnauthorized: true },
      waitForConnections: true, connectionLimit: 3, maxIdle: 1,
      idleTimeout: 30_000, connectTimeout: 8_000,
      queueLimit: 12, timezone: "Z", decimalNumbers: false,
      supportBigNumbers: true, bigNumberStrings: true,
      multipleStatements: false,
    });
  }
  return pool;
}
export async function sql(query, params=[]) {
  return (await database().execute(query, params))[0];
}
export function utcDate(value) {
  // mysql2 parses DATETIME in the configured UTC pool timezone.
  if (value instanceof Date) return value;
  if (!value) return null;
  return new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
}
