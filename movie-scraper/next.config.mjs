const nextConfig = { reactStrictMode:true, async rewrites(){return [{source:"/api/:path*",destination:(process.env.SCRAPER_API_URL||"http://127.0.0.1:5000")+"/api/:path*"}]}};
export default nextConfig;
