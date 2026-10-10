/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/fetch-comments": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};
export default nextConfig;
